/* Explicit, editable modelling assumptions layered over BOOKIPRO data. */
const MODEL_KEY='bonavista-model-v1', REVIEW_KEY='bonavista-reviews-v1';
let model=JSON.parse(localStorage.getItem(MODEL_KEY)||'{}');
const money=n=>new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(n);
const pct=n=>new Intl.NumberFormat('es-ES',{style:'percent',maximumFractionDigits:1}).format(n);
const num=n=>new Intl.NumberFormat('es-ES',{maximumFractionDigits:1}).format(n);
const safe=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const latest=()=>window.PORTFOLIO_BOOKINGS?.length?window.PORTFOLIO_BOOKINGS:(payload?.bookings||[]);
// Inventario confirmado por Pablo (2026-09-30): apartamentos por edificio, no el recuento
// de códigos de apartamento vistos en las reservas cargadas (que puede infravalorarlo).
const KNOWN_UNITS={'Bonavista Passeig de Gracia':10,'Bonavista Virreina':16,'Bonavista Eixample':8,'Bonavista Pedrera':4,'Bonavista Tamarit':7};
function initModel(){
  if(!payload)return;
  model.units||={};model.blocks||={};
  for(const b of [...new Set(latest().map(x=>x.building))]){
    if(model.units[b]===undefined)model.units[b]=KNOWN_UNITS[b]??new Set(latest().filter(x=>x.building===b).map(x=>x.apartment).filter(x=>x&&x!=='Sin apartamento')).size;
    if(model.blocks[b]===undefined)model.blocks[b]=0;
  }
  model.vat ??= 10;
  model.cleaning ??= true;
  model.cancelled ??= null;
  model.priorMonth ??= null;
  model.priorYTD ??= null;
  saveModel();
  showModel();
}
function saveModel(){localStorage.setItem(MODEL_KEY,JSON.stringify(model))}
function showModel(){
  // Panel de hipótesis editables retirado: IVA, inventario y venta directa ya son datos
  // confirmados por Pablo (ver KNOWN_UNITS e isDirectChannel), no hipótesis que ajustar a mano.
  if(!$('assumptionControls'))return;
}
function stayOverlap(item,month){
  if(!item.arrival||!item.departure)return 0;
  const start=month+'-01';let [y,m]=month.split('-').map(Number);
  const end=new Date(Date.UTC(y,m,1)).toISOString().slice(0,10);
  return Math.max(0,Math.round((Math.min(Date.parse(item.departure),Date.parse(end))-Math.max(Date.parse(item.arrival),Date.parse(start)))/86400000));
}
function metrics(monthOverride,buildingOverride){
  const building=buildingOverride??selectedBuilding(), month=monthOverride??$('month').value;
  const all=latest().filter(x=>!building||matchBuilding(x.building,building));
  const months=month?[month]:(window.periodMonths?.()?.months||[...new Set(all.map(x=>x.month))].sort());
  const occupied=all.reduce((sum,x)=>sum+months.reduce((a,m)=>a+stayOverlap(x,m),0),0);
  const overnight=all.reduce((sum,x)=>sum+(x.nights?Math.max(0,x.rental-x.discount+(model.cleaning?(x.cleaning||0):0))*(months.reduce((a,m)=>a+stayOverlap(x,m),0)/x.nights):0),0);
  const present=building?[...building]:[...new Set(all.map(x=>x.building))];
  const available=months.reduce((sum,m)=>{const [year,mo]=m.split('-').map(Number);const days=new Date(year,mo,0).getDate();return sum+present.reduce((a,b)=>a+Math.max(0,(Number(model.units[b])||0)*days-(Number(model.blocks[b])||0)),0)},0);
  const revenue=overnight/(1+Number(model.vat||0)/100);
  const rows=(monthOverride||buildingOverride)?latest().filter(x=>(!month||x.month===month)&&(!building||matchBuilding(x.building,building))):subset();const gross=rows.reduce((a,b)=>a+b.gross,0);
  const directGross=rows.filter(x=>isDirectChannel(x.channel)).reduce((a,b)=>a+b.gross,0);
  return {rows,months,occupied,available,adr:occupied?revenue/occupied:null,revpar:available?revenue/available:null,occupancy:available?occupied/available:null,direct:gross?directGross/gross:null,gross};
}
function chart(title,entries,formatter=money,ordered=false){
  const ranked=entries.filter(([,n])=>Number.isFinite(n)&&n>=0).sort((a,b)=>ordered?String(a[0]).localeCompare(String(b[0])):b[1]-a[1]).slice(0,ordered?31:10);
  const max=Math.max(1,...ranked.map(x=>x[1]));
  if(!ranked.length)return `<div class="panel"><h2>${safe(title)}</h2><p class="note">Sin datos para esta selección.</p></div>`;
  return `<div class="panel"><h2>${safe(title)}</h2><div class="chart-bars ${ordered?'timeline':''}">${ranked.map(([name,n])=>`<div class="chart-column" title="${safe(name)}: ${safe(formatter(n))}"><b>${safe(formatter(n))}</b><div class="bar" style="height:${Math.max(2,80*n/max)}px"></div><span>${safe(ordered?(String(name).length===7?String(name):String(name).slice(-2)):name)}</span></div>`).join('')}</div></div>`;
}
function showCharts(rows){
  const tally=(key,measure=()=>1)=>{const t={};for(const x of rows)t[x[key]]=(t[x[key]]||0)+measure(x);return Object.entries(t)};
  const leadBuckets={'0–7 días':0,'8–30 días':0,'31–90 días':0,'Más de 90 días':0};
  const stayBuckets={'1–2 noches':0,'3–4 noches':0,'5–7 noches':0,'8+ noches':0};
  for(const x of rows){leadBuckets[x.lead<=7?'0–7 días':x.lead<=30?'8–30 días':x.lead<=90?'31–90 días':'Más de 90 días']++;stayBuckets[x.nights<=2?'1–2 noches':x.nights<=4?'3–4 noches':x.nights<=7?'5–7 noches':'8+ noches']++}
  const values=[
   chart('Ventas PVP por mes',tally('month',x=>x.gross),money,true),
   chart('Producción diaria por llegada',tally('arrival',x=>x.gross),money,true),
   chart('Mix de ventas por canal',tally('channel',x=>x.gross)),
   chart('Estancia · distribución',Object.entries(stayBuckets),num),
   chart('Ocupantes por reserva',tally('guests'),num),
   chart('Países de origen · % reservas',tally('country'),n=>pct(n/(rows.length||1))),
   chart('Producción por tarifa',tally('rate',x=>x.gross)),
   chart('Antelación de reserva',Object.entries(leadBuckets),num),
   chart('Noches por edificio',tally('building',x=>x.nights),num),
   chart('Cancelaciones · noches',model.cancelled===null?[]:[['Confirmadas',rows.reduce((n,x)=>n+x.nights,0)],['Canceladas',model.cancelled]],num)
  ];
  $('charts').innerHTML=values.join('');
}
function quarterIndex(dateStr){const d=new Date(dateStr);return d.getFullYear()*4+Math.floor(d.getMonth()/3)}
function quarterLabel(idx){const year=Math.floor(idx/4),q=(idx%4)+1;return 'T'+q+' '+year}
function renderReputationHistory(points,scale){
  if(!points.length)return '<p class="note">Sin capturas todavía.</p>';
  const sorted=points.slice().sort((a,b)=>a.date.localeCompare(b.date));
  const withDelta=sorted.map((p,i)=>({...p,delta:i>0?Math.round((p.score-sorted[i-1].score)*100)/100:null}));
  const endIdx=Math.max(quarterIndex(new Date().toISOString()),quarterIndex(sorted.at(-1).date));
  const cols=[0,1,2,3].map(back=>endIdx-back);
  const byQuarter={};for(const q of cols)byQuarter[q]=[];
  for(const p of withDelta){const qi=quarterIndex(p.date);if(byQuarter[qi])byQuarter[qi].push(p)}
  return `<div class="quarter-grid">${cols.map(q=>{
    const items=byQuarter[q].slice().sort((a,b)=>b.date.localeCompare(a.date));
    return `<div class="quarter-col"><div class="quarter-head">${safe(quarterLabel(q))}</div>${items.length?items.map(p=>`<div class="quarter-row${p.delta<0?' down':p.delta>0?' up':''}" title="${p.delta!==null?(p.delta<0?'Baja respecto a la captura anterior':'Sube respecto a la captura anterior'):'Primera captura registrada'}"><span class="qdate">${new Date(p.date).toLocaleDateString('es-ES',{day:'2-digit',month:'2-digit'})}</span><span class="qscore">${num(p.score)}/${scale}${p.delta!==null?` <i>${p.delta>=0?'+':''}${num(p.delta)}</i>`:''}</span>${p.reviewCount?`<span class="qcount">${num(p.reviewCount)} op.</span>`:''}</div>`).join(''):'<div class="quarter-empty">Sin capturas</div>'}</div>`;
  }).join('')}</div>`;
}
const REVIEW_PLATFORMS=[['Booking',10],['Expedia',10],['Airbnb',5],['Google',5]];
function showReviews(){
  const history=JSON.parse(localStorage.getItem(REVIEW_KEY)||'{}');
  const sel=selectedBuilding(),single=sel&&sel.size===1?[...sel][0]:null;
  if(single){showReviewsDetail(history,single);return}
  showReviewsSummary(history,sel);
}
function showReviewsDetail(history,building){
  $('reviews').innerHTML='<div class="reviews-grid">'+REVIEW_PLATFORMS.map(([platform,scale])=>{
    const key=building+'|'+platform,points=history[key]||[],last=points.at(-1);
    const noDataNote=(building==='Bonavista Tamarit'&&platform!=='Google')?'Bonavista Tamarit todavía no tiene ficha confirmada en '+platform+'.':'Sin captura todavía — usa «Actualizar mercado» más abajo.';
    return `<div class="review-input"><label>${platform} · ${last?num(last.score)+'/'+scale:'sin dato'}${last?.reviewCount?' · '+num(last.reviewCount)+' opiniones':''}</label><small>${last?'Última captura: '+new Date(last.date).toLocaleDateString('es-ES')+(last.source?` · <a href="${safe(last.source)}" target="_blank" rel="noopener noreferrer">fuente</a>`:''):noDataNote}</small>${renderReputationHistory(points,scale)}${last&&last.categories&&Object.keys(last.categories).length?`<small>Aspectos: ${Object.entries(last.categories).map(([k,v])=>`${safe(k)} ${num(v)}`).join(' · ')}</small>`:''}</div>`
  }).join('')+'</div><p class="note">Selección: '+safe(building)+'. Las notas son por edificio: elige uno arriba para verlas (no se agregan varios edificios en una sola cifra). Se cargan con «Actualizar mercado» (lectura automática) o importando el JSON del lector; no hay entrada manual.</p>';
}
function showReviewsSummary(history,sel){
  const buildings=(sel&&sel.size?[...sel]:[...new Set(latest().map(x=>x.building))]).sort();
  if(!buildings.length){$('reviews').innerHTML='<p class="note">Sube reservas para ver la reputación por edificio.</p>';return}
  $('reviews').innerHTML='<div class="reviews-summary">'+buildings.map(building=>{
    const cells=REVIEW_PLATFORMS.map(([platform,scale])=>{
      const key=building+'|'+platform,last=(history[key]||[]).at(-1);
      return `<div class="reviews-summary-cell"><span>${safe(platform)}</span><strong>${last?num(last.score)+'/'+scale:'—'}</strong></div>`;
    }).join('');
    return `<div class="reviews-summary-row"><b>${safe(building)}</b><div class="reviews-summary-cells">${cells}</div></div>`;
  }).join('')+'</div><p class="note">Última nota captada de cada plataforma, por edificio. Elige un único edificio arriba para ver el histórico trimestral completo.</p>';
}
const previousRender=render;
render=function(){
  previousRender();
  initModel();
  const m=metrics();
  showReviews();
  showPickup();
  $('quality').textContent+=' Ocupación estimada con los apartamentos observados en el fichero y sin estancias que empezaron antes del periodo exportado.'+(m.occupancy>1?' Aviso: ocupación superior al 100%; revisa el inventario, los bloqueos o las noches.':'');
};
async function showPickup(){
  const snapshotKey=$('snapshots').value, selection=$('month').value||defaultAnchorMonth(), building=selectedBuilding();
  const list=await listSnapshots().catch(()=>[]);
  const currentIndex=snapshotKey?list.findIndex(x=>x.id===snapshotKey):0;
  if(currentIndex<0)return;
  const previous=list.slice(currentIndex+1).find(x=>x.data.bookings.some(b=>(!selection||b.month===selection)&&(!building||matchBuilding(b.building,building))));
  if(!previous)return;
  const included=x=>(!selection||x.month===selection)&&(!building||matchBuilding(x.building,building));
  const before=previous.data.bookings.filter(included),now=latest().filter(included);
  const delta=now.reduce((s,x)=>s+x.nights,0)-before.reduce((s,x)=>s+x.nights,0);
  const deltaValue=now.reduce((s,x)=>s+x.gross,0)-before.reduce((s,x)=>s+x.gross,0);
  const card=document.querySelector('[data-metric="pickup"]');
  if(card && selection===($('month').value||defaultAnchorMonth()) && buildingsEqual(building,selectedBuilding())){
    card.querySelector('strong').textContent=(delta>=0?'+':'')+num(delta)+' noches';
    card.querySelector('em').textContent=(deltaValue>=0?'+':'')+money(deltaValue)+' PVP desde '+new Date(previous.id).toLocaleDateString('es-ES')+' · comparar cobertura';
  }
}
const previousSetup=setupFilters;
setupFilters=function(data){previousSetup(data);initModel()};
