/* Explicit, editable modelling assumptions layered over Bookypro data. */
const MODEL_KEY='bonavista-model-v1', REVIEW_KEY='bonavista-reviews-v1';
let model=JSON.parse(localStorage.getItem(MODEL_KEY)||'{}');
const money=n=>new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(n);
const pct=n=>new Intl.NumberFormat('es-ES',{style:'percent',maximumFractionDigits:1}).format(n);
const num=n=>new Intl.NumberFormat('es-ES',{maximumFractionDigits:1}).format(n);
const safe=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const latest=()=>window.PORTFOLIO_BOOKINGS?.length?window.PORTFOLIO_BOOKINGS:(payload?.bookings||[]);
function initModel(){
  if(!payload)return;
  model.units||={};model.blocks||={};
  for(const b of [...new Set(latest().map(x=>x.building))]){
    if(model.units[b]===undefined)model.units[b]=new Set(latest().filter(x=>x.building===b).map(x=>x.apartment).filter(x=>x&&x!=='Sin apartamento')).size;
    if(model.blocks[b]===undefined)model.blocks[b]=0;
  }
  model.vat ??= 10;
  model.cleaning ??= false;
  model.cancelled ??= null;
  model.priorMonth ??= null;
  model.priorYTD ??= null;
  model.direct ??= 'Bonavista,Witbooking,Excliente';
  saveModel();
  showModel();
}
function saveModel(){localStorage.setItem(MODEL_KEY,JSON.stringify(model))}
function showModel(){
  const buildings=[...new Set(latest().map(x=>x.building))].sort();
  $('assumptionControls').innerHTML=`<div class="assumption-grid">
   <label>IVA supuesto sobre alojamiento (%)<input id="vat" type="number" min="0" max="30" step="0.1" value="${model.vat}"></label>
   <label>Canales considerados directos<input id="direct" type="text" value="${safe(model.direct)}"></label>
   <label>Noches canceladas (si se conocen)<input id="cancelled" type="number" min="0" step="1" value="${model.cancelled??''}" placeholder="Sin dato"></label>
   </div><p class="assumption-note">Para ocupación y RevPAR, número de apartamentos observado en el fichero como punto de partida. Comprueba el inventario real y los bloqueos. ADR supone que «Precio alquiler» incluye el IVA indicado y excluye limpieza.</p>
   <label class="assumption-note"><input id="cleaning" type="checkbox" ${model.cleaning?'checked':''}> Incluir limpieza final en la base de ADR y RevPAR (hipótesis editable)</label>
   <div>${buildings.map(b=>`<div class="inventory-row"><b>${safe(b)}</b><label>Apartamentos disponibles<input class="units" data-building="${safe(b)}" type="number" min="0" step="1" value="${model.units[b]}"></label><label>Noches bloqueadas en el mes<input class="blocks" data-building="${safe(b)}" type="number" min="0" step="1" value="${model.blocks[b]}"></label></div>`).join('')}</div>`;
  for(const id of ['vat','direct','cancelled'])$(id).addEventListener('change',()=>{
    model.vat=Number($('vat').value);model.direct=$('direct').value;model.cleaning=$('cleaning').checked;
    model.cancelled=$('cancelled').value===''?null:Number($('cancelled').value);
    saveModel();render();
  });
  $('cleaning').addEventListener('change',()=>{model.cleaning=$('cleaning').checked;saveModel();render()});
  document.querySelectorAll('.units,.blocks').forEach(input=>input.addEventListener('change',()=>{
    const b=input.dataset.building;const n=Number(input.value);
    if(input.classList.contains('units'))model.units[b]=n;else model.blocks[b]=n;
    saveModel();render();
  }));
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
  const direct=new Set(model.direct.split(',').map(x=>x.trim().toLowerCase()).filter(Boolean));
  const directGross=rows.filter(x=>direct.has(x.channel.toLowerCase())).reduce((a,b)=>a+b.gross,0);
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
function nearestPoint(points,targetTime,toleranceDays){
  let best=null,bestDiff=Infinity;
  for(const p of points){const diff=Math.abs(new Date(p.date).getTime()-targetTime);if(diff<bestDiff&&diff<=toleranceDays*86400000){best=p;bestDiff=diff}}
  return best;
}
function reviewMovement(points){
  const last=points.at(-1);if(!last)return'';
  const lastTime=new Date(last.date).getTime();
  const monthAgo=nearestPoint(points.slice(0,-1),lastTime-30*86400000,10);
  const yearAgo=nearestPoint(points.slice(0,-1),lastTime-365*86400000,30);
  const fmt=(ref)=>ref?`${last.score-ref.score>=0?'+':''}${num(last.score-ref.score)} desde ${new Date(ref.date).toLocaleDateString('es-ES')}`:'sin captura de referencia';
  return `<small>Vs. mes anterior: ${fmt(monthAgo)}</small><small>Vs. año anterior: ${fmt(yearAgo)}</small>`;
}
function showReviews(){
  const history=JSON.parse(localStorage.getItem(REVIEW_KEY)||'{}');
  const sel=selectedBuilding(),single=sel&&sel.size===1?[...sel][0]:null;
  if(!single){$('reviews').innerHTML='<p class="note">Elige un único edificio arriba (no «Todos» ni varios) para ver y editar su reputación; las notas no se agregan entre edificios.</p>';return}
  const building=single;
  $('reviews').innerHTML='<div class="reviews-grid">'+[['Booking',10],['Expedia',10],['Airbnb',5],['Google',5]].map(([platform,scale])=>{
    const key=building+'|'+platform,points=history[key]||[],last=points.at(-1);
    return `<div class="review-input"><label>${platform} · ${last?num(last.score)+'/'+scale:'sin dato'}${last?.reviewCount?' · '+num(last.reviewCount)+' opiniones':''}</label><small>${last?'Última captura: '+new Date(last.date).toLocaleDateString('es-ES')+(last.source?` · <a href="${safe(last.source)}" target="_blank" rel="noopener noreferrer">fuente</a>`:''):'Sin captura inicial'}</small>${reviewMovement(points)}<input type="number" step="0.1" min="0" max="${scale}" placeholder="Nota de 0 a ${scale}" data-platform="${platform}" data-scale="${scale}"><div class="assumption-grid"><input type="number" min="0" max="${scale}" step="0.1" placeholder="Limpieza" data-category="cleaning" data-owner="${platform}"><input type="number" min="0" max="${scale}" step="0.1" placeholder="Atención" data-category="staff" data-owner="${platform}"><input type="number" min="0" max="${scale}" step="0.1" placeholder="Ubicación" data-category="location" data-owner="${platform}"></div>${last&&last.categories&&Object.keys(last.categories).length?`<small>Aspectos: ${Object.entries(last.categories).map(([k,v])=>`${safe(k)} ${num(v)}`).join(' · ')}</small>`:''}<button class="ghost" data-save-review="${platform}">Guardar nota</button></div>`
  }).join('')+'</div><p class="note">Selección: '+safe(building)+'. Las notas son por edificio: elige uno arriba para verlas (no se agregan varios edificios en una sola cifra). Introduce solo las categorías que publique cada plataforma; no se mezclan escalas de plataformas distintas.</p>';
  document.querySelectorAll('[data-save-review]').forEach(button=>button.addEventListener('click',()=>{
    const name=button.dataset.saveReview,input=document.querySelector(`[data-platform="${name}"]`),raw=input.value,score=Number(raw),scale=Number(input.dataset.scale);
    if(raw===''||!Number.isFinite(score)||score<0||score>scale){alert('Introduce una nota entre 0 y '+scale);return}
    const categories={};document.querySelectorAll(`[data-owner="${name}"]`).forEach(x=>{if(x.value!==''){const v=Number(x.value);if(Number.isFinite(v)&&v>=0&&v<=scale)categories[x.dataset.category]=v}});
    (history[building+'|'+name]??=[]).push({date:new Date().toISOString(),score,categories});localStorage.setItem(REVIEW_KEY,JSON.stringify(history));showReviews();
  }));
}
function showCompetitorReviews(){
  const holder=$('competitorReviews');if(!holder)return;
  const db=window.BONAVISTA_MARKET?.read?.()||{reviews:[]};
  const sel=selectedBuilding(),single=sel&&sel.size===1?[...sel][0]:null;
  if(!single){holder.innerHTML='<p class="note">Elige un único edificio arriba (no «Todos» ni varios) para ver su competencia.</p>';return}
  const all=db.reviews.filter(x=>x.competitor&&x.building===single).map(x=>({...x,date:x.capturedAt}));
  const types=[...new Set(all.map(x=>x.businessType).filter(Boolean))].sort();
  const zones=[...new Set(all.map(x=>x.postalCode).filter(Boolean))].sort();
  const typeSel=$('competitorTypeFilter'),zoneSel=$('competitorZoneFilter');
  if(typeSel){const cur=typeSel.value;typeSel.innerHTML='<option value="">Todos los tipos</option>'+types.map(t=>`<option value="${safe(t)}" ${cur===t?'selected':''}>${safe(t)}</option>`).join('')}
  if(zoneSel){const cur=zoneSel.value;zoneSel.innerHTML='<option value="">Todos los códigos postales</option>'+zones.map(z=>`<option value="${safe(z)}" ${cur===z?'selected':''}>${safe(z)}</option>`).join('')}
  const typeFilter=typeSel?.value||'',zoneFilter=zoneSel?.value||'';
  const filtered=all.filter(x=>(!typeFilter||x.businessType===typeFilter)&&(!zoneFilter||x.postalCode===zoneFilter));
  const byCompetitor={};for(const r of filtered)(byCompetitor[r.competitor]??=[]).push(r);
  const names=Object.keys(byCompetitor).sort();
  if(!names.length){holder.innerHTML=`<p class="note">Sin competidores cargados todavía para ${safe(single)}${typeFilter||zoneFilter?' con este filtro':''}. Se añaden a mano en integrations/public-pages.json (array «competitors») y se cargan con «Actualizar mercado» o importando el JSON del lector.</p>`;return}
  holder.innerHTML='<div class="reviews-grid">'+names.map(name=>{
    const points=byCompetitor[name].slice().sort((a,b)=>a.date.localeCompare(b.date)),last=points.at(-1);
    return `<div class="review-input"><label>${safe(name)} · ${num(last.score)}/5${last.reviewCount?' · '+num(last.reviewCount)+' opiniones':''}</label><small>${safe(last.businessType||'Tipo sin definir')}${last.postalCode?' · CP '+safe(last.postalCode):''}</small><small>Última captura: ${new Date(last.date).toLocaleDateString('es-ES')}${last.source?` · <a href="${safe(last.source)}" target="_blank" rel="noopener noreferrer">fuente</a>`:''}</small>${reviewMovement(points)}</div>`;
  }).join('')+'</div><p class="note">Solo Google: Booking y Expedia no se leen para terceros por sus condiciones de uso. Lista manual de competidores, no descubrimiento automático.</p>';
}
$('competitorTypeFilter')?.addEventListener('change',showCompetitorReviews);
$('competitorZoneFilter')?.addEventListener('change',showCompetitorReviews);
const previousRender=render;
render=function(){
  previousRender();
  initModel();
  const m=metrics();
  showReviews();
  showCompetitorReviews();
  showPickup();
  $('quality').textContent+=' Ocupación estimada con los apartamentos observados en el fichero y sin estancias que empezaron antes del periodo exportado.'+(m.occupancy>1?' Aviso: ocupación superior al 100%; revisa el inventario, los bloqueos o las noches.':'');
};
async function showPickup(){
  const snapshotKey=$('snapshots').value, selection=$('month').value||[...new Set(latest().map(x=>x.month))].sort().at(-1), building=selectedBuilding();
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
  if(card && selection===($('month').value||[...new Set(latest().map(x=>x.month))].sort().at(-1)) && buildingsEqual(building,selectedBuilding())){
    card.querySelector('strong').textContent=(delta>=0?'+':'')+num(delta)+' noches';
    card.querySelector('em').textContent=(deltaValue>=0?'+':'')+money(deltaValue)+' PVP desde '+new Date(previous.id).toLocaleDateString('es-ES')+' · comparar cobertura';
  }
}
const previousSetup=setupFilters;
setupFilters=function(data){previousSetup(data);initModel()};
