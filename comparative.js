/* Month-to-date pace, prior-year full-month benchmark and rolling twelve-month metrics. */
(function(){
'use strict';
const KEYS=['gross','nights','bookings','guestsTotal','guestsKnown','leadTotal','rentalNet','overlapNights','overlapRentalNet'];
const DIMS=['channel','rate','country','guests','stay','lead','arrival'];
function empty(){return {gross:0,nights:0,bookings:0,guestsTotal:0,guestsKnown:0,leadTotal:0,rentalNet:0,overlapNights:0,overlapRentalNet:0,categories:Object.fromEntries(DIMS.map(k=>[k,{}]))}}
function add(a,b){if(!b)return a;for(const key of KEYS)a[key]+=Number(b[key]||0);for(const dim of DIMS)for(const [name,entry] of Object.entries(b.categories?.[dim]||{})){const t=a.categories[dim][name]??={gross:0,count:0,nights:0};for(const k of ['gross','count','nights'])t[k]+=Number(entry[k]||0)}return a}
function current(month,building){const a=empty();for(const x of latest()){if(x.month!==month||(building&&!matchBuilding(x.building,building)))continue;a.gross+=x.gross||0;a.nights+=x.nights||0;a.bookings++;a.rentalNet+=(x.rental||0)-(x.discount||0)+(model.cleaning?(x.cleaning||0):0);a.leadTotal+=x.lead||0;if(x.guests!==null&&Number.isFinite(x.guests)){a.guestsTotal+=x.guests;a.guestsKnown++}const stay=x.nights<=2?'1–2 noches':x.nights<=4?'3–4 noches':x.nights<=7?'5–7 noches':'8+ noches',lead=x.lead<=7?'0–7 días':x.lead<=30?'8–30 días':x.lead<=90?'31–90 días':'Más de 90 días';for(const [dim,name] of Object.entries({channel:x.channel,rate:x.rate,country:x.country,guests:x.guests===null?'Sin dato':String(x.guests),stay,lead,arrival:x.arrival})){const t=a.categories[dim][name||'Sin dato']??={gross:0,count:0,nights:0};t.gross+=x.gross||0;t.count++;t.nights+=x.nights||0}}const ov=liveRangeStats(month+'-01',month+'-'+String(monthDays(month)).padStart(2,'0'),building);a.overlapNights=ov.nights;a.overlapRentalNet=ov.rentalNet;return a}
function historic(month,building,day){const a=empty();let finalArrivalNights=0;for(const row of historical?.rows||[]){if(row.month!==month||(building&&!matchBuilding(row.building,building))||!row.analysis)continue;finalArrivalNights+=Number(row.analysis.nights||0);if(day===undefined)add(a,row.analysis);else{add(a,row.analysisBeforeMonth);for(const [d,delta] of Object.entries(row.analysisDailyIncrements||{}))if(Number(d)<=day)add(a,delta)}}
 /* Ocupación/ADR/RevPAR reales usan noches ocupadas dentro del mes (reparto noche a noche), igual que el año en curso; con corte por día se escala por la parte ya reservada. */
 let on=0,orn=0,found=false;for(const r of historical?.dailyRows||[]){if(!r.date.startsWith(month+'-'))continue;if(building&&!matchBuilding(r.building,building))continue;found=true;on+=r.nights||0;orn+=r.rentalNet||0}
 if(found){const scale=day===undefined?1:(finalArrivalNights>0?Math.min(1,a.nights/finalArrivalNights):0);a.overlapNights=on*scale;a.overlapRentalNet=orn*scale}else{a.overlapNights=a.nights;a.overlapRentalNet=a.rentalNet}
 return a}
function hasHistory(month,building){return !!historical?.rows?.some(x=>x.month===month&&(!building||matchBuilding(x.building,building))&&x.analysis)}
const amount=v=>new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(v);
const numeric=v=>new Intl.NumberFormat('es-ES',{maximumFractionDigits:1}).format(v);
const percent=v=>new Intl.NumberFormat('es-ES',{style:'percent',maximumFractionDigits:1}).format(v);
/* Perímetro constante: edificios con datos este mes que no existían el mismo mes del año anterior (p. ej. Tamarit, abierto en agosto de 2026) se separan, para ofrecer también la comparación "sin ellos". */
function constantPerimeter(month,building){
 const prev=monthEarlier(month,-12);
 const cur=new Set(latest().filter(x=>x.month===month&&(!building||matchBuilding(x.building,building))).map(x=>x.building));
 const before=new Set((historical?.rows||[]).filter(r=>r.month===prev&&r.analysis).map(r=>r.building));
 if(!cur.size||!before.size)return null;
 const keep=[...cur].filter(b=>before.has(b)),excluded=[...cur].filter(b=>!before.has(b));
 if(!excluded.length||!keep.length)return null;
 return {set:new Set(keep),excluded,label:'sin '+excluded.map(b=>b.replace(/^Bonavista /,'')).join(' ni ')};
}
window.constantPerimeter=constantPerimeter;
function monthDays(month){const [y,m]=month.split('-').map(Number);return new Date(Date.UTC(y,m,0)).getUTCDate()}
function monthEarlier(month,delta){const [y,m]=month.split('-').map(Number),d=new Date(Date.UTC(y,m-1+delta,1));return d.toISOString().slice(0,7)}
function reportCurrentMonth(){return new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit'}).format(new Date())}
function defaultAnchorMonth(){const months=[...new Set(latest().map(x=>x.month))].sort();if(!months.length)return undefined;const past=months.filter(m=>m<=reportCurrentMonth());return past.length?past.at(-1):months.at(-1)}
window.defaultAnchorMonth=defaultAnchorMonth;
function asOfDay(month){const iso=window.PORTFOLIO_ASOF?.[month]||payload?.meta?.as_of||new Date().toISOString().slice(0,10);
 /* El corte es la fecha de la última carga. Si el mes comparado es posterior a ese mes (p. ej. octubre con datos a 30/9), a esa fecha del año anterior solo estaba lo reservado antes del mes (día 0); si es anterior, ya está cerrado. */
 const asMonth=iso.slice(0,7);if(month>asMonth)return 0;if(month<asMonth)return 31;return Math.max(1,Math.min(31,Number(iso.slice(8,10))||1))}
function bars(title,entries,formatter=amount){const rows=entries.slice(0,title.startsWith('Producción por día')?31:title.startsWith('Ventas PVP mensual')?12:10),max=Math.max(1,...rows.flatMap(x=>x.values).filter(x=>x!==null).map(x=>x||0));return `<div class="panel comparison-card ${title.startsWith('Producción por día')?'daily-comparison':''}"><h2>${safe(title)}</h2>${rows.length?`<div class="comparison-head"><span></span><span>Actual</span><span>Año ant. a fecha</span><span>Año ant. cierre</span></div>${rows.map(({label,values})=>`<div class="comparison-row"><b title="${safe(label)}">${safe(label)}</b>${values.map((v,i)=>`<span title="${safe(label)} · ${['Actual','Año anterior a fecha','Año anterior cierre'][i]}: ${v===null?'sin dato':safe(formatter(v))}"><em class="cmp-track"><i class="cmp-fill cmp-${i}" style="width:${v===null?0:Math.max(1,v/max*100)}%"></i></em><strong>${v===null?'—':safe(formatter(v))}</strong></span>`).join('')}</div>`).join('')}`:'<p class="note">Sin datos para este gráfico.</p>'}</div>`}
function compareCharts(){
 if(!payload)return;
 const building=selectedBuilding(),ps=periodStats(building);
 if(!ps){$('charts').innerHTML='';return}
 const p=ps.p,mode=p.mode,anchorMonth=$('month').value||defaultAnchorMonth();
 if(!ps.now){$('charts').innerHTML='<div class="panel"><h2>Comparación de gráficos</h2><p class="note">Faltan meses del periodo elegido por cargar.</p></div>';return}
 if(!ps.before){$('charts').innerHTML='<div class="panel"><h2>Comparación de gráficos</h2><p class="note">Importa el histórico analítico agregado para comparar todas las series con el año anterior'+safe(ps.coverageNote)+'.</p></div>';return}
 const now=ps.now,openMonth=mode==='month'&&p.anchor===reportCurrentMonth(),cut=(mode==='month'&&openMonth)?ps.before:null,prior=(mode==='month'&&openMonth)?historic(monthEarlier(p.anchor,-12),building):ps.before;
 const periodLabel=p.months.length>1?p.months[0]+' a '+p.months.at(-1):p.anchor,prevLabel=p.prevMonths.length>1?p.prevMonths[0]+' a '+p.prevMonths.at(-1):p.prevMonths[0];
 const series=(dim,metric,ratio=false)=>{const normalize=source=>{if(!source)return null;if(dim!=='arrival')return source;const byDay={};for(const [key,value] of Object.entries(source)){const day=key.slice(-2),target=byDay[day]??={gross:0,count:0,nights:0};for(const k of ['gross','count','nights'])target[k]+=value[k]||0}return byDay};const a=normalize(now.categories[dim]),b=normalize(cut?.categories[dim]),c=normalize(prior?.categories[dim]),keys=[...new Set([...Object.keys(a),...Object.keys(b||{}),...Object.keys(c||{})])];const value=(o,key,total)=>{if(!o)return null;const v=o[key]?.[metric]||0;return ratio?total?100*v/total:0:v};return keys.map(key=>({label:dim==='arrival'?key.slice(-2):key,values:[value(a,key,now.bookings),value(b,key,cut?.bookings||0),value(c,key,prior?.bookings||0)],rank:(value(a,key,now.bookings)||0)+(value(c,key,prior?.bookings||0)||0)})).sort((x,y)=>y.rank-x.rank)};
 const months=Array.from({length:12},(_,i)=>{const m=anchorMonth.slice(0,4)+'-'+String(i+1).padStart(2,'0'),pm=monthEarlier(m,-12),exists=latest().some(x=>x.month===m);return {label:m.slice(5),values:[exists?current(m,building).gross:null,m===reportCurrentMonth()&&hasHistory(pm,building)?historic(pm,building,asOfDay(m)).gross:null,hasHistory(pm,building)?historic(pm,building).gross:null]}});
 const arrivals=series('arrival','gross').map(x=>({label:x.label,values:x.values})).sort((a,b)=>Number(a.label)-Number(b.label));
 const cancelPrior=p.prevMonths.reduce((s,m)=>s+historical.rows.filter(x=>x.month===m&&(!building||matchBuilding(x.building,building))).reduce((n,x)=>n+Number(x.cancelledNights||0),0),0);
 const canceled=(mode==='month'&&openMonth&&model.cancelled!==null)?Number(model.cancelled):null;
 $('charts').innerHTML=[bars('Ventas PVP mensual · '+anchorMonth.slice(0,4)+' (contexto, no sigue el selector)',months,amount),bars('Producción por día de llegada · '+periodLabel,arrivals,amount),bars('Canales · PVP',series('channel','gross'),amount),bars('Estancia · reservas',series('stay','count'),numeric),bars('Ocupantes · reservas',series('guests','count'),numeric),bars('Países · % reservas',series('country','count',true),v=>numeric(v)+' %'),bars('Tarifas · PVP',series('rate','gross'),amount),bars('Antelación · reservas',series('lead','count'),numeric),bars('Noches por edificio · '+p.anchor+' (contexto, no sigue el selector)',[...new Set([...latest().filter(x=>x.month===p.anchor).map(x=>x.building),...historical.rows.filter(x=>x.month===monthEarlier(p.anchor,-12)).map(x=>x.building)])].filter(x=>matchBuilding(x,building)).map(name=>({label:name.replace('Bonavista ',''),values:[current(p.anchor,name).nights,openMonth?historic(monthEarlier(p.anchor,-12),name,asOfDay(p.anchor)).nights:null,historic(monthEarlier(p.anchor,-12),name).nights]})),numeric),bars('Cancelaciones · noches',[{label:'Canceladas',values:[canceled,null,cancelPrior]},{label:'Confirmadas',values:[now.nights,cut?.nights??null,prior?.nights??null]}],numeric)].join('')+`<p class="note comparison-foot">${safe(periodLabel)} frente a ${safe(prevLabel)}. Los dos primeros gráficos son siempre de contexto anual, independientes del selector Mes/Acumulado/TAM; el resto sigue el periodo elegido arriba. Solo el mes en curso usa una comparación al mismo día; en Acumulado año y TAM se compara el cierre completo del periodo equivalente del año anterior. Las series del año actual proceden de las cargas presentes. Cancelaciones actuales: ${canceled===null?'sin exportación o solo disponible en modo Mes':'hipótesis editable'}. Los países representan porcentaje de reservas.</p>`;
}
function completeMonth(month,building){if(month>=reportCurrentMonth())return null;if(latest().some(x=>x.month===month&&(!building||matchBuilding(x.building,building))))return current(month,building);return hasHistory(month,building)?historic(month,building):null}
function trailing(end,building){const a=empty();for(let i=11;i>=0;i--){const one=completeMonth(monthEarlier(end,-i),building);if(!one)return null;add(a,one)}return a}
const PACE_KEYS=[['gross','Ventas PVP',v=>amount(v)],['nights','Noches reservadas',v=>numeric(v)],['count','Reservas',v=>numeric(v)],['stay','Estancia media',v=>numeric(v)+' noches'],['guests','Ocupantes medios',v=>numeric(v)],['lead','Antelación',v=>numeric(v)+' días'],['direct','Venta directa',v=>percent(v)],['occupancy','Ocupación',v=>percent(v)],['adr','ADR sin IVA',v=>amount(v)],['revpar','RevPAR sin IVA',v=>amount(v)],['cancel','Cancelaciones',v=>percent(v)]];
const PACE_RATIO_KEYS=new Set(['direct','occupancy','cancel']);
function monthlyValue(m,building,key){
 const prev=monthEarlier(m,-12),loaded=latest().some(x=>x.month===m&&(!building||matchBuilding(x.building,building))),hasHist=hasHistory(prev,building),date=asOfDay(m);
 let now=null;
 if(key==='cancel'){now=m===reportCurrentMonth()&&model.cancelled!==null?Number(model.cancelled)/(Number(model.cancelled)+current(m,building).nights||1):null}
 else if(loaded){now=['occupancy','adr','revpar'].includes(key)?metrics(m,building)[key]:detailMetric(current(m,building),key,m,building)}
 let cut=null;
 if(m===reportCurrentMonth()&&hasHist&&key!=='cancel')cut=detailMetric(historic(prev,building,date),key,prev,building);
 let final=null;
 if(hasHist){
  if(key==='cancel'){const canceled=historical.rows.filter(x=>x.month===prev&&(!building||matchBuilding(x.building,building))).reduce((n,x)=>n+Number(x.cancelledNights||0),0),confirmed=historic(prev,building).nights;final=(canceled+confirmed)>0?canceled/(canceled+confirmed):null}
  else final=detailMetric(historic(prev,building),key,prev,building);
 }
 return{now,cut,final};
}
function renderPaceMonthly(){const holder=$('paceMonthly');if(!holder||!payload)return;const selected=$('month').value||defaultAnchorMonth();if(!selected)return;const year=Number(selected.slice(0,4)),building=selectedBuilding();const choice=holder.querySelector('#paceMeasure')?.value||'gross';const [,title,format]=PACE_KEYS.find(k=>k[0]===choice)||PACE_KEYS[0];const isRatio=PACE_RATIO_KEYS.has(choice);const months=Array.from({length:12},(_,i)=>{const m=year+'-'+String(i+1).padStart(2,'0'),v=monthlyValue(m,building,choice);return {month:m,values:[v.now,v.cut,v.final]}});const altByMonth=new Map();for(const {month} of months){const p=constantPerimeter(month,building);if(!p)continue;const v=monthlyValue(month,p.set,choice);const d=(v.now===null||v.final===null)?null:v.now-v.final;altByMonth.set(month,{label:p.label,text:d===null?'—':isRatio?((d>=0?'+':'')+numeric(d*100)+' p.p.'):(!v.final?'—':((d>=0?'+':'')+percent(d/v.final)))})}const altLabel=[...altByMonth.values()][0]?.label;const max=Math.max(1,...months.flatMap(m=>m.values.map(v=>isRatio?(v||0)*100:v)).filter(v=>v!==null));const diffLine=(v,ref)=>v===null||ref===null?null:v-ref;const shortNumber=v=>{const abs=Math.abs(v);if(abs>=1e6)return(v/1e6).toFixed(2).replace('.',',')+'M';if(abs>=1e3)return String(Math.round(v/1e3))+'k';return String(Math.round(v))};const isMoney=['gross','adr','revpar'].includes(choice);const compact=v=>v===null?'—':isMoney?shortNumber(v)+' €':format(v);const barHeight=v=>v===null?0:Math.max(2,125*(isRatio?v*100:v)/max);
holder.innerHTML=`<div class="pace-month-title"><div><div class="mini">MES A MES · MESES CERRADOS; MES ACTUAL A FECHA</div><h3>${safe(title)} · ${year} frente a ${year-1}</h3></div><label>Indicador <select id="paceMeasure">${PACE_KEYS.map(([k,label])=>`<option value="${k}" ${choice===k?'selected':''}>${safe(label)}</option>`).join('')}</select></label></div><div class="pace-month-legend"><span><i class="cmp-0"></i>${year} cierre salvo mes actual</span><span><i class="cmp-1"></i>${year-1} al mismo día (mes actual)</span><span><i class="cmp-2"></i>${year-1} cierre completo</span><span><i class="cmp-target"></i>Techo ${year-1} (solo mes en curso)</span></div><p class="note">El recuadro rojo marca el mes en curso según la fecha de hoy.</p><p class="chart-hint">👉 Pulsa una barra para ver los indicadores de ese mes (queda marcada en gris).</p><div class="pace-month-grid">${months.map(({month,values})=>{const isCurrent=month===reportCurrentMonth();const prevMonth=String(Number(month.slice(0,4))-1)+month.slice(4);const refHeight=isCurrent&&values[2]!==null?barHeight(values[2]):null;const barIndices=(isCurrent?[0,1]:[0,2]).filter(i=>values[i]!==null);const ceiling=`<div class="pace-month-ceiling">${isCurrent&&values[2]!==null?`<em>Cierre ${safe(prevMonth)}</em>${safe(compact(values[2]))}`:''}</div>`;const vsAA=isCurrent?diffLine(values[0],values[1]):diffLine(values[0],values[2]);const vsAAtext=vsAA===null?'—':isRatio?('vs AA: '+(vsAA>=0?'+':'')+numeric(vsAA*100)+' p.p.'):('vs AA: '+(vsAA>=0?'+':'')+percent(vsAA/(isCurrent?values[1]:values[2])));const clickable=values[0]!==null,isSelected=month===$('month').value;return `<div class="pace-month ${isCurrent?'current':''}${isSelected?' selected':''}${clickable?' clickable':''}" title="${safe(month)}: ${values.map(v=>v===null?'sin carga':format(v)).join(' / ')}"${clickable?` onclick="openMonthFromChart('${month}')"`:''}>${ceiling}<div class="pace-month-bars">${refHeight!==null?`<div class="pace-month-target" style="bottom:${refHeight}px"></div>`:''}${barIndices.map(i=>{const h=barHeight(values[i]);return `<div class="pace-month-barwrap"><span class="pace-month-barlabel" style="bottom:${h+3}px">${safe(compact(values[i]))}</span><div class="pace-month-bar cmp-${i}" style="height:${h}px"></div></div>`}).join('')}</div><b>${safe(month.slice(5))}</b><small>${safe(vsAAtext)}</small></div>`}).join('')}</div><table class="pace-month-table"><thead><tr><th>Mes</th><th>${safe(title)} ${year}</th><th>Cierre ${year-1}</th><th>Diferencia</th><th>Diferencia %</th>${altLabel?`<th>Dif. % ${safe(altLabel)}</th>`:''}</tr></thead><tbody>${months.map(({month,values})=>{const diff=diffLine(values[0],values[2]);const diffText=diff===null?'—':isRatio?((diff>=0?'+':'')+numeric(diff*100)+' p.p.'):((diff>=0?'+':'')+format(diff));const diffPctText=diff===null||isRatio||!values[2]?'—':((diff>=0?'+':'')+percent(diff/values[2]));return `<tr class="${month===selected?'chosen':''}"><td>${safe(month)}</td><td>${values[0]===null?'—':safe(format(values[0]))}</td><td>${values[2]===null?'—':safe(format(values[2]))}</td><td>${safe(diffText)}</td><td>${safe(diffPctText)}</td>${altLabel?`<td>${safe(altByMonth.get(month)?.text||'—')}</td>`:''}</tr>`}).join('')}</tbody></table><p class="note">Un mes sin carga figura como «—». Solo en el mes en curso, el año anterior al mismo día se reconstruye con la fecha de reserva y el estado final, sin histórico de cambios de importe ni cancelaciones. La línea discontinua marca el cierre de ${year-1} como referencia del mes. ADR, ocupación, RevPAR y venta directa son estimaciones sobre el inventario y las reglas ya confirmadas con Pablo.</p>`;holder.querySelector('#paceMeasure')?.addEventListener('change',renderPaceMonthly)}
function renderYtdCurve(){
 const holder=$('ytdCurve');if(!holder||!payload)return;
 const p=periodMonths();if(!p){holder.innerHTML='';return}
 const year=Number(p.anchor.slice(0,4)),upTo=Number(p.anchor.slice(5,7)),building=selectedBuilding(),day=asOfDay(p.anchor);
 const choice=holder.querySelector('#paceMeasure')?.value||'gross';
 const [,title,format]=PACE_KEYS.find(k=>k[0]===choice)||PACE_KEYS[0];
 const isRatio=PACE_RATIO_KEYS.has(choice);
 const shortNumber=v=>{const abs=Math.abs(v);if(abs>=1e6)return(v/1e6).toFixed(2).replace('.',',')+'M';if(abs>=1e3)return String(Math.round(v/1e3))+'k';return String(Math.round(v))};
 const isMoney=['gross','adr','revpar'].includes(choice);
 const compact=v=>v===null?'—':isMoney?shortNumber(v)+' €':format(v);
 const cutoffs=Array.from({length:12},(_,i)=>{
  const m=i+1,monthKey=year+'-'+String(m).padStart(2,'0');
  if(m>upTo)return {month:monthKey,now:null,prior:null};
  const cur=yearToDate(monthKey,building,false);
  const prevYearMonth=(year-1)+'-'+String(m).padStart(2,'0');
  const pr=yearToDate(prevYearMonth,building,true,m===upTo?day:undefined);
  const comparable=cur.monthsUsed.length===m&&pr.monthsUsed.length===m;
  const now=cur.monthsUsed.length?detailMetric(cur.stats,choice,cur.monthsUsed.map(mm=>year+'-'+String(mm).padStart(2,'0')),building):null;
  const prior=comparable?detailMetric(pr.stats,choice,pr.monthsUsed.map(mm=>(year-1)+'-'+String(mm).padStart(2,'0')),building):null;
  return {month:monthKey,now,prior};
 });
 const fullPriorYtd=yearToDate((year-1)+'-12',building,true);
 const fullPrior=fullPriorYtd.monthsUsed.length===12?detailMetric(fullPriorYtd.stats,choice,Array.from({length:12},(_,i)=>(year-1)+'-'+String(i+1).padStart(2,'0')),building):null;
 const max=Math.max(1,...cutoffs.flatMap(c=>[c.now,c.prior]).concat([fullPrior]).map(v=>isRatio?(v||0)*100:v).filter(v=>v!==null));
 const barHeight=v=>v===null?0:Math.max(2,125*(isRatio?v*100:v)/max);
 const diffLine=(v,ref)=>v===null||ref===null?null:v-ref;
 holder.innerHTML=`<div class="pace-month-title"><div><div class="mini">ACUMULADO AÑO · ENERO A CADA MES</div><h3>${safe(title)} · acumulado ${year} frente a ${year-1}</h3></div><label>Indicador <select id="paceMeasure">${PACE_KEYS.map(([k,label])=>`<option value="${k}" ${choice===k?'selected':''}>${safe(label)}</option>`).join('')}</select></label></div><div class="pace-month-legend"><span><i class="cmp-0"></i>Acumulado ${year}</span><span><i class="cmp-2"></i>Acumulado ${year-1} mismo alcance</span><span><i class="cmp-target"></i>Cierre completo ${year-1}</span></div><p class="note">Cada barra es el total desde enero hasta ese mes, no el mes aislado. El mes en curso se corta a la fecha de la última exportación.</p><p class="chart-hint">👉 Pulsa una barra para ver los indicadores acumulados hasta ese mes (queda marcada en gris).</p><div class="pace-month-grid">${cutoffs.map(({month,now,prior})=>{
  const isCurrent=month===p.anchor&&p.isOpen;
  const refHeight=isCurrent&&fullPrior!==null?barHeight(fullPrior):null;
  const barIndices=[0,2].filter(i=>(i===0?now:prior)!==null);
  const ceiling=`<div class="pace-month-ceiling">${isCurrent&&fullPrior!==null?`<em>Cierre ${year-1}</em>${safe(compact(fullPrior))}`:''}</div>`;
  const vsAA=diffLine(now,prior);
  const vsAAtext=vsAA===null?'—':isRatio?('vs AA: '+(vsAA>=0?'+':'')+numeric(vsAA*100)+' p.p.'):('vs AA: '+(vsAA>=0?'+':'')+percent(vsAA/prior));
  const clickable=now!==null,isSelected=month===$('month').value;return `<div class="pace-month ${isCurrent?'current':''}${isSelected?' selected':''}${clickable?' clickable':''}" title="${safe(month)}: ${now===null?'sin carga':safe(format(now))} / ${prior===null?'sin dato':safe(format(prior))}"${clickable?` onclick="openMonthFromChart('${month}')"`:''}>${ceiling}<div class="pace-month-bars">${refHeight!==null?`<div class="pace-month-target" style="bottom:${refHeight}px"></div>`:''}${barIndices.map(i=>{const v=i===0?now:prior,h=barHeight(v);return `<div class="pace-month-barwrap"><span class="pace-month-barlabel" style="bottom:${h+3}px">${safe(compact(v))}</span><div class="pace-month-bar cmp-${i}" style="height:${h}px"></div></div>`}).join('')}</div><b>${safe(month.slice(5))}</b><small>${safe(vsAAtext)}</small></div>`}).join('')}</div><table class="pace-month-table"><thead><tr><th>Hasta mes</th><th>${safe(title)} ${year}</th><th>${safe(title)} ${year-1}</th><th>Diferencia</th><th>Diferencia %</th></tr></thead><tbody>${cutoffs.map(({month,now,prior})=>{const diff=diffLine(now,prior);const diffText=diff===null?'—':isRatio?((diff>=0?'+':'')+numeric(diff*100)+' p.p.'):((diff>=0?'+':'')+format(diff));const diffPctText=diff===null||isRatio||!prior?'—':((diff>=0?'+':'')+percent(diff/prior));return `<tr class="${month===p.anchor?'chosen':''}"><td>${safe(month)}</td><td>${now===null?'—':safe(format(now))}</td><td>${prior===null?'—':safe(format(prior))}</td><td>${safe(diffText)}</td><td>${safe(diffPctText)}</td></tr>`}).join('')}</tbody></table><p class="note">Comparación solo cuando ambos años tienen cargado el mismo número de meses hasta ese punto. La línea discontinua marca el cierre completo de ${year-1} como referencia del año.</p>`;
 holder.querySelector('#paceMeasure')?.addEventListener('change',renderYtdCurve);
}
function renderEvolutionMain(){
 const mode=window.PERIOD_MODE||'month';
 const monthOnly=document.querySelectorAll('.pace-only');
 monthOnly.forEach(el=>el.style.display=mode==='month'?'':'none');
 $('paceMonthly').style.display=mode==='month'?'':'none';
 $('ytdCurve').style.display=mode==='year'?'':'none';
 $('rollingMAT').style.display=mode==='tam'?'':'none';
 if($('customRange'))$('customRange').style.display=mode==='custom'?'':'none';
 if(mode==='month')renderPaceMonthly();
 else if(mode==='year')renderYtdCurve();
 else if(mode==='tam')renderMAT();
 else renderCustomRange();
}
/* Fechas personalizadas: reparte cada reserva viva noche a noche sobre el rango elegido (no por
   mes de llegada), y compara contra el histórico ya repartido noche a noche (dailyRows) en el
   rango de comparación (por defecto, mismas fechas un año antes; editable para fiestas móviles
   como Semana Santa). */
function daysBetweenDates(a,b){return Math.round((Date.parse(b+'T00:00:00Z')-Date.parse(a+'T00:00:00Z'))/86400000)}
function addDaysStr(dateStr,n){const d=new Date(dateStr+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)}
function yearAgoStr(dateStr){if(!dateStr)return dateStr;const d=new Date(dateStr+'T00:00:00Z');d.setUTCFullYear(d.getUTCFullYear()-1);return d.toISOString().slice(0,10)}
function liveRangeStats(start,end,building){
 let gross=0,rentalNet=0,nights=0;
 for(const x of latest()){
  if(building&&!matchBuilding(x.building,building))continue;
  if(!x.arrival||!x.departure)continue;
  const lastNight=addDaysStr(x.departure,-1);
  const overlapStart=x.arrival>start?x.arrival:start,overlapEnd=lastNight<end?lastNight:end;
  if(overlapStart>overlapEnd)continue;
  const overlapNights=daysBetweenDates(overlapStart,overlapEnd)+1;
  const totalNights=x.nights||daysBetweenDates(x.arrival,x.departure);
  if(totalNights<=0)continue;
  gross+=(x.gross||0)*overlapNights/totalNights;
  rentalNet+=((x.rental||0)-(x.discount||0)+(model.cleaning?(x.cleaning||0):0))*overlapNights/totalNights;
  nights+=overlapNights;
 }
 return {gross,rentalNet,nights};
}
function historicalRangeStats(start,end,building){
 let gross=0,rentalNet=0,nights=0;
 for(const r of historical?.dailyRows||[]){
  if(r.date<start||r.date>end)continue;
  if(building&&!matchBuilding(r.building,building))continue;
  gross+=r.gross||0;rentalNet+=r.rentalNet||0;nights+=r.nights||0;
 }
 return {gross,rentalNet,nights};
}
function rangeAvailable(start,end,building){
 if(!start||!end||start>end)return 0;
 const days=daysBetweenDates(start,end)+1;
 const units=building?[...building]:[...new Set([...latest().map(x=>x.building),...(historical?.dailyRows||[]).map(x=>x.building)])];
 return units.reduce((s,b)=>s+(Number(model.units[b])||0)*days,0);
}
function renderCustomRange(){
 const target=$('customRange');if(!target||!payload)return;
 const building=selectedBuilding();
 const prior=target.querySelector('#rangeStart')?{start:target.querySelector('#rangeStart').value,end:target.querySelector('#rangeEnd').value,prevStart:target.querySelector('#rangePrevStart').value,prevEnd:target.querySelector('#rangePrevEnd').value}:{};
 const todayIso=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Madrid'}).format(new Date());
 const start=prior.start||(todayIso.slice(0,8)+'01'),end=prior.end||todayIso;
 const prevStart=prior.prevStart||yearAgoStr(start),prevEnd=prior.prevEnd||yearAgoStr(end);
 const valid=start&&end&&start<=end,prevValid=prevStart&&prevEnd&&prevStart<=prevEnd;
 const now=valid?liveRangeStats(start,end,building):null;
 const before=prevValid?historicalRangeStats(prevStart,prevEnd,building):null;
 const availNow=valid?rangeAvailable(start,end,building):0,availPrev=prevValid?rangeAvailable(prevStart,prevEnd,building):0;
 const adr=v=>v&&v.nights?v.rentalNet/(1+Number(model.vat||0)/100)/v.nights:null;
 const revpar=(v,a)=>v&&a>0?(v.rentalNet/(1+Number(model.vat||0)/100))/a:null;
 const occ=(v,a)=>v&&a>0?v.nights/a:null;
 const cases=[
  ['Ventas PVP',v=>v?v.gross:null,amount],
  ['Noches',v=>v?v.nights:null,numeric],
  ['ADR sin IVA',v=>adr(v),amount],
  ['Ocupación',(v,a)=>occ(v,a),percent],
  ['RevPAR sin IVA',(v,a)=>revpar(v,a),amount]
 ];
 const body=!valid?'<p class="note">Elige una fecha de inicio del periodo actual anterior o igual a la de fin.</p>'
  :!prevValid?'<p class="note">Revisa el periodo de comparación: la fecha de inicio debe ser anterior o igual a la de fin.</p>'
  :!historical?.dailyRows?.length?'<p class="note">Importa el histórico (con desglose diario) en «Opciones avanzadas» para poder comparar con el año anterior.</p>'
  :`<div class="mat-grid">${cases.map(([label,fn,format])=>{const a=fn(now,availNow),b=fn(before,availPrev),delta=(a!==null&&b)?(a-b)/b:null;return `<div class="mat-cell"><span>${safe(label)}</span><strong>${a===null?'—':safe(format(a))}</strong><small>Año anterior: ${b===null?'—':safe(format(b))}${delta!==null?' · '+safe((delta>=0?'+':'')+percent(delta)):''}</small></div>`}).join('')}</div>
  <p class="note">Periodo actual: reservas reales con fecha de estancia dentro del rango, repartidas noche a noche (no por mes de llegada). Periodo de comparación: histórico importado, también noche a noche. Ocupación y RevPAR usan el inventario por edificio sin descontar bloqueos.</p>`;
 target.innerHTML=`<div class="custom-range-row">
  <div class="custom-range-group"><b>Periodo actual</b><div class="custom-range-dates"><label>Desde <input type="date" id="rangeStart" value="${safe(start)}"></label><label>Hasta <input type="date" id="rangeEnd" value="${safe(end)}"></label></div></div>
  <div class="custom-range-group"><b>Periodo de comparación</b><div class="custom-range-dates"><label>Desde <input type="date" id="rangePrevStart" value="${safe(prevStart)}"></label><label>Hasta <input type="date" id="rangePrevEnd" value="${safe(prevEnd)}"></label></div></div>
 </div>${body}`;
 ['rangeStart','rangeEnd','rangePrevStart','rangePrevEnd'].forEach(id=>target.querySelector('#'+id)?.addEventListener('change',renderCustomRange));
}
function matCurve(building,metric,format,fn){
 const months=[...new Set([...(historical?.rows||[]).map(x=>x.month),...latest().map(x=>x.month)])].sort();
 const points=months.map(month=>({month,stats:trailing(month,building)})).filter(x=>x.stats).slice(-24);
 const values=points.map(x=>fn(x.stats)),known=values.filter(v=>v!==null);
 if(!known.length)return '<p class="note">Sin datos suficientes para trazar esta serie.</p>';
 const dataMin=Math.min(...known),dataMax=Math.max(...known);
 // The axis deliberately does not start at zero: TAM values move in a narrow band, and a
 // zero-based scale flattens real trend changes into an almost straight line.
 const pad=(dataMax-dataMin)*0.15||Math.abs(dataMax)*0.1||1,domainMin=dataMin-pad,domainMax=dataMax+pad,range=domainMax-domainMin||1;
 const stepX=58,width=Math.max(stepX*points.length,stepX),plotTop=16,plotBottom=90,height=112;
 const xAt=i=>i*stepX+stepX/2,yAt=v=>plotBottom-((v-domainMin)/range)*(plotBottom-plotTop);
 let path='',started=false;
 points.forEach((p,i)=>{const v=values[i];if(v===null){started=false;return}path+=`${started?'L':'M'}${xAt(i).toFixed(1)},${yAt(v).toFixed(1)} `;started=true});
 const dots=points.map((p,i)=>{const v=values[i];return v===null?'':`<circle cx="${xAt(i).toFixed(1)}" cy="${yAt(v).toFixed(1)}" r="3" class="mat-dot"><title>${safe(p.month)}: ${safe(format(v))}</title></circle>`}).join('');
 const labels=points.map((p,i)=>`<text x="${xAt(i).toFixed(1)}" y="106" class="mat-axis-label" text-anchor="middle">${safe(p.month.slice(5))}</text>`).join('');
 return `<div class="mat-curve"><svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" class="mat-curve-svg"><text x="4" y="${(plotTop+8).toFixed(1)}" class="mat-axis-label" text-anchor="start">${safe(format(domainMax))}</text><text x="4" y="${(plotBottom).toFixed(1)}" class="mat-axis-label" text-anchor="start">${safe(format(domainMin))}</text><path d="${path.trim()}" class="mat-line" fill="none"/>${dots}${labels}</svg></div><p class="note">Cada punto agrega los 12 meses anteriores hasta el mes indicado; pasa el ratón por un punto para ver su valor exacto. El eje vertical no empieza en cero, va de ${safe(format(domainMin))} a ${safe(format(domainMax))}: muestra el rango real de la serie para que se vea el cambio de tendencia, no el volumen absoluto. No se trazan periodos que carezcan de alguno de sus 12 meses.</p>`;
}
function renderMAT(){const target=$('rollingMAT');if(!target||!payload)return;if(!historical?.rows?.some(x=>x.analysis)){target.innerHTML='<p class="note">Importa el histórico analítico para calcular los últimos 12 meses completos.</p>';return}const building=selectedBuilding(),months=[...new Set([...(historical.rows||[]).map(x=>x.month),...latest().map(x=>x.month)])].sort().reverse();let end,now,prev;for(const m of months){const a=trailing(m,building),b=trailing(monthEarlier(m,-12),building);if(a&&b){end=m;now=a;prev=b;break}}if(!end){target.innerHTML='<p class="note">Todavía no hay dos ventanas consecutivas de 12 meses con datos para comparar.</p>';return}const share=x=>x.gross?Object.entries(x.categories.channel).reduce((n,[key,v])=>n+(isDirectChannel(key)?v.gross:0),0)/x.gross:null;const cases=[['Ventas PVP',x=>x.gross,amount],['Noches reservadas',x=>x.nights,numeric],['Reservas',x=>x.bookings,numeric],['Estancia media',x=>x.bookings?x.nights/x.bookings:null,x=>numeric(x)+' noches'],['Ocupantes medios',x=>x.guestsKnown?x.guestsTotal/x.guestsKnown:null,numeric],['Antelación',x=>x.bookings?x.leadTotal/x.bookings:null,x=>numeric(x)+' días'],['Venta directa',share,percent],['ADR alquiler sin IVA*',x=>x.nights?x.rentalNet/(1+Number(model.vat||0)/100)/x.nights:null,amount]];
 target.innerHTML=`<div class="summary-top"><div><div class="mini">TAM · ÚLTIMOS 12 MESES</div><h2>Cierre a ${safe(end)} frente al TAM anterior</h2></div><span class="mini">${safe(buildingLabel(building))}</span></div><div class="mat-grid">${cases.map(([label,fn,format])=>{const a=fn(now),b=fn(prev);return `<div class="mat-cell"><span>${safe(label)}</span><strong>${a===null?'—':safe(format(a))}</strong><small>Anterior: ${b===null?'—':safe(format(b))}${a!==null&&b!==null&&b!==0?' · '+safe(percent((a-b)/b)):' '}</small></div>`}).join('')}</div><div class="mat-curve-control"><label>Evolución TAM <select id="matMetric">${cases.map(([name],i)=>`<option value="${i}">${safe(name)}</option>`).join('')}</select></label></div><div id="matCurve"></div><p class="note">Ventanas: ${safe(monthEarlier(end,-11))}–${safe(end)} y ${safe(monthEarlier(end,-23))}–${safe(monthEarlier(end,-12))}. Si faltan meses de 2026, se muestra el último TAM completo disponible. Cada año puede tener distinto inventario; compara el mismo edificio para mantener el perímetro. *ADR estimado: alquiler menos descuento, IVA ${safe(model.vat||0)} %, dividido entre noches de reserva; pendiente de validación contable.</p>`;const picker=target.querySelector('#matMetric'),curve=target.querySelector('#matCurve');if(picker&&curve){const draw=()=>{const [name,fn,format]=cases[Number(picker.value)||0];curve.innerHTML=`<h3>${safe(name)} · evolución mensual del TAM</h3>`+matCurve(building,name,format,fn)};picker.addEventListener('change',draw);draw()}
}
function monthBuildings(month){return new Set([...latest().filter(x=>x.month===month).map(x=>x.building),...(historical?.rows||[]).filter(x=>x.month===month).map(x=>x.building)])}
function detailMetric(stats,key,months,building){
 if(!stats)return null;
 const monthList=Array.isArray(months)?months:[months];
 const units=building?[...building]:[...new Set(monthList.flatMap(m=>[...monthBuildings(m)]))];
 const available=monthList.reduce((sum,m)=>sum+units.reduce((n,b)=>n+(Number(model.units[b])||0)*new Date(Number(m.slice(0,4)),Number(m.slice(5,7)),0).getDate()-(Number(model.blocks?.[b])||0),0),0);
 const ovNights=stats.overlapNights||stats.overlapRentalNet?stats.overlapNights:stats.nights,ovRental=stats.overlapNights||stats.overlapRentalNet?stats.overlapRentalNet:stats.rentalNet;const revenue=ovRental/(1+Number(model.vat||0)/100);
 switch(key){case 'gross':return stats.gross;case 'count':return stats.bookings;case 'nights':return stats.nights;case 'stay':return stats.bookings?stats.nights/stats.bookings:null;case 'guests':return stats.guestsKnown?stats.guestsTotal/stats.guestsKnown:null;case 'lead':return stats.bookings?stats.leadTotal/stats.bookings:null;case 'direct':return stats.gross?Object.entries(stats.categories.channel).reduce((s,[name,value])=>s+(isDirectChannel(name)?value.gross:0),0)/stats.gross:null;case 'adr':return ovNights?revenue/ovNights:null;case 'occupancy':return available>0?ovNights/available:null;case 'revpar':return available>0?revenue/available:null;default:return null}
}
window.PERIOD_MODE=window.PERIOD_MODE||'month';
function periodMonths(){
 const anchor=$('month').value||defaultAnchorMonth();
 if(!anchor)return null;
 const mode=window.PERIOD_MODE||'month',isOpen=anchor===reportCurrentMonth();
 let months,resolvedAnchor=anchor,resolvedOpen=isOpen;
 if(mode==='year'){const year=anchor.slice(0,4),upTo=Number(anchor.slice(5,7));months=Array.from({length:upTo},(_,i)=>year+'-'+String(i+1).padStart(2,'0'))}
 else if(mode==='tam'){const end=isOpen?monthEarlier(anchor,-1):anchor;months=Array.from({length:12},(_,i)=>monthEarlier(end,-(11-i)));resolvedAnchor=end;resolvedOpen=false}
 else months=[anchor];
 return {months,prevMonths:months.map(m=>monthEarlier(m,-12)),anchor:resolvedAnchor,isOpen:resolvedOpen,mode};
}
window.periodMonths=periodMonths;
const PERIOD_LABELS={month:'Mes',year:'Acumulado año',tam:'TAM · últimos 12 meses',custom:'Fechas personalizadas'};
function ensurePeriodControl(){
 if($('periodTabs'))return;
 const anchor=document.querySelector('.panel.pace');if(!anchor)return;
 const bar=document.createElement('div');bar.className='period-control';bar.id='periodTabs';
 bar.innerHTML='<div class="period-tabs" role="tablist">'+Object.entries(PERIOD_LABELS).map(([mode,label])=>`<button type="button" data-mode="${mode}">${safe(label)}</button>`).join('')+'</div><p class="note" id="periodLabel"></p>';
 anchor.parentNode.insertBefore(bar,anchor);
 bar.querySelectorAll('[data-mode]').forEach(btn=>btn.addEventListener('click',()=>{window.PERIOD_MODE=btn.dataset.mode;render()}));
}
function renderPeriodControl(){
 ensurePeriodControl();
 const mode=window.PERIOD_MODE||'month',p=periodMonths();
 document.querySelectorAll('#periodTabs [data-mode]').forEach(btn=>btn.classList.toggle('active',btn.dataset.mode===mode));
 const label=$('periodLabel');if(!label)return;
 if(mode==='custom'){label.textContent='Elige el rango de fechas abajo; se compara con el periodo que indiques del año anterior.';return}
 if(!p){label.textContent='';return}
 const first=p.months[0],last=p.months.at(-1),range=p.months.length>1?`${first} a ${last}`:first;
 const coverage=p.months.filter(m=>latest().some(x=>x.month===m)).length;
 label.textContent=`${range} · ${coverage}/${p.months.length} meses con carga`+(p.isOpen?' · mes en curso, cifras a fecha de la última exportación':(mode!=='month'&&coverage<p.months.length?' · faltan meses por cargar':''));
}
function renderContextLine(){
 const holder=$('contextLine');if(!holder)return;
 if(!payload){holder.textContent='';holder.classList.remove('context-alert');return}
 const mode=window.PERIOD_MODE||'month',p=periodMonths();
 const lastLoad=Object.values(window.PORTFOLIO_ASOF||{}).concat(payload.meta.as_of?[payload.meta.as_of]:[]).sort().at(-1);
 const viewingPast=typeof isViewingPastMonth==='function'&&isViewingPastMonth();
 if(viewingPast&&mode==='month'){
  holder.classList.add('context-alert');
  holder.innerHTML=`⚠ Mostrando datos de ${safe(p.anchor)}, no del mes en curso <button type="button" id="resetPeriodTop">Volver al mes actual</button>`;
  $('resetPeriodTop').onclick=()=>resetToLatestMonth();
  return;
 }
 holder.classList.remove('context-alert');
 const periodText=p?(PERIOD_LABELS[mode]+' · '+p.anchor):'';
 holder.textContent=[periodText,lastLoad?'Última carga: '+new Date(lastLoad).toLocaleDateString('es-ES'):''].filter(Boolean).join(' · ');
}
function yearToDate(month,building,useHistoric,cutDay){
 const year=month.slice(0,4),upTo=Number(month.slice(5,7)),acc=empty(),monthsUsed=[];
 for(let m=1;m<=upTo;m++){const key=year+'-'+String(m).padStart(2,'0');
  if(useHistoric){if(hasHistory(key,building)){add(acc,(m===upTo&&cutDay!=null)?historic(key,building,cutDay):historic(key,building));monthsUsed.push(m)}}
  else if(latest().some(x=>x.month===key&&(!building||matchBuilding(x.building,building)))){add(acc,current(key,building));monthsUsed.push(m)}
 }
 return {stats:acc,monthsUsed};
}
const KPI_SPECS=[
 ['count','Reservas',numeric,'Confirmadas en la selección'],
 ['nights','Noches reservadas',numeric,'No equivale a ocupación'],
 ['stay','Estancia media',v=>numeric(v)+' noches','Por reserva'],
 ['guests','Ocupantes medios',numeric,'Por reserva con dato'],
 ['lead','Antelación media',v=>numeric(v)+' días','Reserva → llegada'],
];
function periodStats(building){
 const p=periodMonths();if(!p)return null;
 if(p.mode==='year'){
  const day=asOfDay(p.anchor);
  const cur=yearToDate(p.anchor,building,false),prevYearMonth=String(Number(p.anchor.slice(0,4))-1)+p.anchor.slice(4),pr=yearToDate(prevYearMonth,building,true,day);
  const comparable=cur.monthsUsed.length&&pr.monthsUsed.length&&cur.monthsUsed.length===pr.monthsUsed.length;
  return {p,now:cur.stats,before:comparable?pr.stats:null,coverageNote:(!comparable&&cur.monthsUsed.length&&pr.monthsUsed.length)?' (cobertura insuficiente, no comparable)':''};
 }
 if(p.mode==='tam'){
  const prevEnd=monthEarlier(p.anchor,-12),now=trailing(p.anchor,building),before=trailing(prevEnd,building);
  return {p,now,before,coverageNote:!now?' (faltan meses de los últimos 12 por cargar)':(!before?' (sin ventana de 12 meses completa el año anterior)':'')};
 }
 const day=asOfDay(p.anchor),prev=monthEarlier(p.anchor,-12);
 return {p,now:current(p.anchor,building),before:hasHistory(prev,building)?historic(prev,building,day):null,coverageNote:''};
}
function renderKpi(){
 const holder=$('cards');if(!holder||!payload)return;
 renderPeriodControl();
 const building=selectedBuilding(),ps=periodStats(building);
 if(!ps){holder.innerHTML='';return}
 holder.innerHTML=KPI_SPECS.map(([key,label,fmt,caption])=>{
  const now=ps.now?detailMetric(ps.now,key,ps.p.months,building):null;
  const before=ps.before?detailMetric(ps.before,key,ps.p.prevMonths,building):null;
  const delta=(now===null||before===null||!before)?null:(now-before)/before;
  const deltaText=delta===null?(ps.now?('Sin comparación'+safe(ps.coverageNote)):'Sin datos para este periodo'):('vs AA: '+(delta>=0?'+':'')+percent(delta));
  return `<button class="card" onclick="detail('${key}')"><span>${safe(label)}</span><strong>${now===null?'—':safe(fmt(now))}</strong><em>${safe(caption)}</em><small class="yoy">${safe(deltaText)}</small></button>`;
 }).join('');
}
/* "Lo más destacado" busca cambios de tendencia reales frente al año anterior (mismo punto de
   corte): variaciones de doble dígito en ventas, ADR, RevPAR, ocupación, venta directa o mezcla
   de canales. Si no hay histórico o nada supera el umbral, cae a datos informativos del periodo. */
function computeHighlights(){
 if(!payload)return[];
 const building=selectedBuilding(),month=$('month').value||defaultAnchorMonth();
 if(!month)return[];
 const rows=subset(),bullets=[];
 const prev=monthEarlier(month,-12),day=asOfDay(month);
 if(hasHistory(prev,building)){
  const now=current(month,building),before=historic(prev,building,day);
  const pushRel=(label,nowVal,beforeVal,fmt,threshold,goodIfUp=true)=>{
   if(nowVal===null||beforeVal===null||!beforeVal)return;
   const delta=(nowVal-beforeVal)/beforeVal;
   if(Math.abs(delta)<threshold)return;
   bullets.push({text:`${label} ${delta>=0?'sube':'baja'} un ${percent(Math.abs(delta))} frente al mismo punto del año anterior (${fmt(beforeVal)} → ${fmt(nowVal)}).`,kind:(delta>=0)===goodIfUp?'good':'bad',mag:Math.abs(delta)});
  };
  const pushPP=(label,nowVal,beforeVal,thresholdPP,goodIfUp=true)=>{
   if(nowVal===null||beforeVal===null)return;
   const deltaPP=(nowVal-beforeVal)*100;
   if(Math.abs(deltaPP)<thresholdPP)return;
   bullets.push({text:`${label} ${deltaPP>=0?'sube':'baja'} ${numeric(Math.abs(deltaPP))} puntos frente al año anterior (${percent(beforeVal)} → ${percent(nowVal)}).`,kind:(deltaPP>=0)===goodIfUp?'good':'bad',mag:Math.abs(deltaPP)/10});
  };
  pushRel('Ventas PVP',now.gross,before.gross,amount,0.10);
  const adr=monthlyValue(month,building,'adr'),adrRef=adr.cut??adr.final;
  pushRel('El ADR',adr.now,adrRef,amount,0.10);
  const revpar=monthlyValue(month,building,'revpar'),revparRef=revpar.cut??revpar.final;
  pushRel('El RevPAR',revpar.now,revparRef,amount,0.10);
  const occ=monthlyValue(month,building,'occupancy'),occRef=occ.cut??occ.final;
  pushPP('La ocupación',occ.now,occRef,5);
  const direct=monthlyValue(month,building,'direct'),directRef=direct.cut??direct.final;
  pushPP('La venta directa',direct.now,directRef,5);
  const leadNow=now.bookings?now.leadTotal/now.bookings:null,leadBefore=before.bookings?before.leadTotal/before.bookings:null;
  if(leadNow!==null&&leadBefore){const d=(leadNow-leadBefore)/leadBefore;if(Math.abs(d)>=0.15)bullets.push({text:`La antelación media ${d>=0?'sube':'baja'} un ${percent(Math.abs(d))}: reservas ${d>=0?'con más':'de más última hora'} respecto al año anterior (${numeric(leadBefore)} → ${numeric(leadNow)} días).`,kind:'info',mag:Math.abs(d)});}
  const shareOf=(agg,name)=>{const c=agg.categories.channel[name];return agg.gross&&c?c.gross/agg.gross:0};
  const channels=new Set([...Object.keys(now.categories.channel),...Object.keys(before.categories.channel)]);
  let biggestShift=null;
  for(const ch of channels){const d=(shareOf(now,ch)-shareOf(before,ch))*100;if(!biggestShift||Math.abs(d)>Math.abs(biggestShift.d))biggestShift={ch,d}}
  if(biggestShift&&Math.abs(biggestShift.d)>=5)bullets.push({text:`${biggestShift.ch} ${biggestShift.d>=0?'gana':'pierde'} ${numeric(Math.abs(biggestShift.d))} puntos de peso sobre el total frente al año anterior.`,kind:'info',mag:Math.abs(biggestShift.d)/10});
 }
 bullets.sort((a,b)=>b.mag-a.mag);
 if(bullets.length<2){
  const share=(key)=>{const totals={};for(const r of rows)totals[r[key]]=(totals[r[key]]||0)+r.gross;const total=rows.reduce((s,r)=>s+r.gross,0)||1;const sorted=Object.entries(totals).sort((a,b)=>b[1]-a[1]);return sorted.length?{name:sorted[0][0],pct:sorted[0][1]/total}:null};
  if(!building){const top=share('building');if(top)bullets.push({text:`${top.name} lidera la producción con ${percent(top.pct)} del total del periodo.`,kind:'info',mag:0})}
  const topChannel=share('channel');if(topChannel)bullets.push({text:`${topChannel.name} es el canal con más producción: ${percent(topChannel.pct)} del PVP.`,kind:'info',mag:0});
 }
 return bullets.slice(0,4);
}
/* "Datos a supervisar": incidencias de calidad de datos, separadas de los hallazgos de negocio. */
function computeWatchouts(){
 if(!payload)return[];
 const building=selectedBuilding(),month=$('month').value||defaultAnchorMonth();
 const bullets=[];
 if(payload.meta.reconciliation_warnings>0)bullets.push(`${payload.meta.reconciliation_warnings} reserva(s) con el total PVP sin conciliar del todo con el CSV de servicios.`);
 if(payload.meta.channel_coverage<payload.meta.reservations)bullets.push(`${payload.meta.reservations-payload.meta.channel_coverage} reserva(s) sin canal identificado.`);
 if(payload.meta.date_warnings>0)bullets.push(`${payload.meta.date_warnings} reserva(s) con diferencias entre fechas de estancia y noches registradas.`);
 if(month){const m=metrics(month,building);if(m.occupancy!==null&&m.occupancy>1)bullets.push('La ocupación estimada supera el 100 % — revisa el inventario de apartamentos y los bloqueos.')}
 return bullets;
}
function renderHighlights(){
 const holder=$('highlights');if(!holder)return;
 const bullets=computeHighlights();
 holder.innerHTML=bullets.length?`<h2>Lo más destacado</h2><ul class="highlights-list">${bullets.map(b=>`<li class="hl-${b.kind}">${safe(b.text)}</li>`).join('')}</ul><p class="note">Generado con reglas a partir de los datos cargados en este navegador; no es un resumen redactado por IA.</p>`:'';
 const watchHolder=$('watchouts');if(!watchHolder)return;
 const watchouts=computeWatchouts();
 watchHolder.innerHTML=watchouts.length?`<h2>Datos a supervisar</h2><ul class="highlights-list">${watchouts.map(t=>`<li class="hl-warn">${safe(t)}</li>`).join('')}</ul><p class="note">Avisos de calidad de los datos cargados, no de rendimiento del negocio.</p>`:'';
}
function toplineMonthValue(key,building,month,day){
 const prev=monthEarlier(month,-12);
 if(['occupancy','adr','revpar'].includes(key)){
  const now=metrics(month,building)[key],before=hasHistory(prev,building)?detailMetric(historic(prev,building,day),key,prev,building):null;
  return{now,before};
 }
 const now=current(month,building).gross,before=hasHistory(prev,building)?historic(prev,building,day).gross:null;
 return{now,before};
}
function toplineTile(label,value,fmt,delta,ppMode,alt){
 const deltaText=delta===null?'Sin comparación: importa el histórico':(ppMode?`${(delta*100)>=0?'+':''}${numeric(delta*100)} p.p. vs AA`:`${delta>=0?'+':''}${percent(delta)} vs AA`);
 const cls=delta===null?'':(delta>=0?'good':'bad');
 return `<div class="topline-tile ${cls}"><span>${safe(label)}</span><strong>${value===null||value===undefined?'—':safe(fmt(value))}</strong><small>${deltaText}</small>${alt?`<small class="alt">${safe(alt.label)}: ${alt.now==null?'—':safe(fmt(alt.now))} · ${alt.delta===null?'—':(ppMode?`${(alt.delta*100)>=0?'+':''}${numeric(alt.delta*100)} p.p.`:`${alt.delta>=0?'+':''}${percent(alt.delta)}`)}</small>`:''}</div>`;
}
function renderTopline(){
 const holder=$('topline');if(!holder)return;
 if(!payload){holder.innerHTML='';return}
 const building=selectedBuilding(),month=reportCurrentMonth();
 const hasCurrent=latest().some(x=>x.month===month&&(!building||matchBuilding(x.building,building)));
 const lastLoadedMonth=[...new Set(latest().map(x=>x.month))].sort().at(-1);
 if(!hasCurrent){
  holder.innerHTML=`<h2>${safe(month)} · ${safe(buildingLabel(building))}</h2><p class="note">Sin carga del mes en curso todavía${lastLoadedMonth?'; última carga disponible: '+safe(lastLoadedMonth):''}. Sube la exportación de ${safe(month)} en «Subir nuevos datos» para ver aquí cómo va el mes actual.</p>`;
  return;
 }
 const asOf=window.PORTFOLIO_ASOF?.[month]||payload.meta.as_of;
 const day=asOfDay(month);
 const pvp=toplineMonthValue('gross',building,month,day);
 const pvpDelta=(pvp.now==null||pvp.before==null||!pvp.before)?null:(pvp.now-pvp.before)/pvp.before;
 const prev=monthEarlier(month,-12),hasHist=hasHistory(prev,building);
 const priorClose=hasHist?historic(prev,building).gross:null;
 const progress=priorClose>0&&pvp.now!=null?Math.round(100*pvp.now/priorClose):null;
 const occ=toplineMonthValue('occupancy',building,month,day),occDelta=(occ.now==null||occ.before==null)?null:occ.now-occ.before;
 const adr=toplineMonthValue('adr',building,month,day),adrDelta=(adr.now==null||adr.before==null||!adr.before)?null:(adr.now-adr.before)/adr.before;
 const revpar=toplineMonthValue('revpar',building,month,day),revparDelta=(revpar.now==null||revpar.before==null||!revpar.before)?null:(revpar.now-revpar.before)/revpar.before;
 const perim=constantPerimeter(month,building);const altFor=(key,ppMode)=>{if(!perim)return null;const v=toplineMonthValue(key,perim.set,month,day);const delta=(v.now==null||v.before==null||(!ppMode&&!v.before))?null:(ppMode?v.now-v.before:(v.now-v.before)/v.before);return {label:perim.label[0].toUpperCase()+perim.label.slice(1),now:v.now,delta}};
 holder.innerHTML=`<div class="summary-top"><h2>${safe(month)} · ${safe(buildingLabel(building))}</h2><span class="mini">Datos a ${safe(asOf?new Date(asOf).toLocaleDateString('es-ES'):'—')}</span></div>
 ${priorClose?`<div class="pace-goal"><span>CIERRE ${safe(prev)} · REFERENCIA A ALCANZAR</span><strong>${safe(amount(priorClose))}</strong><div class="pace-goal-progress"><i style="width:${Math.min(100,Math.max(0,progress||0))}%"></i></div><small>${progress===null?'Sin referencia':safe(String(progress)+' % del cierre anterior')} · diferencia ${safe(amount((pvp.now||0)-priorClose))}</small></div>`:''}
 <div class="topline-grid">
  ${toplineTile('Ventas PVP en cartera'+(day===0?' · al cierre del mes anterior':' · día '+day),pvp.now,amount,pvpDelta,false,altFor('gross'))}
  ${toplineTile('Ocupación estimada del mes',occ.now,percent,occDelta,true,altFor('occupancy',true))}
  ${toplineTile('ADR sin IVA (estimado)',adr.now,amount,adrDelta,false,altFor('adr'))}
  ${toplineTile('RevPAR sin IVA (estimado)',revpar.now,amount,revparDelta,false,altFor('revpar'))}
 </div><p class="note">La cifra del año anterior al mismo día es una reconstrucción desde fecha de reserva y estado final; no recupera cancelaciones ni cambios de importe posteriores. Ocupación, ADR y RevPAR dependen del inventario y las reglas ya confirmadas con Pablo. El acumulado del año está en el bloque «Evolución», con Acumulado año.</p>`;
}
/* Pickup: lo que ha cambiado desde la carga anterior, mes a mes, comparando capturas guardadas por id de reserva. Una reserva que estaba y ya no está se cuenta como cancelada o retirada. */
async function renderPickup(){
 const holder=$('pickup');if(!holder)return;
 if(!payload||window.VIEWING_SNAPSHOT){holder.innerHTML='';return}
 let snaps;try{snaps=await listSnapshots()}catch(e){holder.innerHTML='';return}
 const building=selectedBuilding(),asOf=payload.meta.as_of||'',asOfMonth=asOf.slice(0,7);
 const inScope=x=>!building||matchBuilding(x.building,building);
 const months=[...new Set(latest().map(x=>x.month))].filter(m=>!asOfMonth||m>=asOfMonth).sort();
 const rows=[];let prevAsOf='';
 for(const m of months){
  const i=snaps.findIndex(sn=>sn.data.bookings.some(x=>x.month===m));
  if(i<0)continue;
  const older=snaps.slice(i+1).find(sn=>sn.data.bookings.some(x=>x.month===m));
  if(!older)continue;
  const cur=snaps[i].data.bookings.filter(x=>x.month===m&&inScope(x)),old=older.data.bookings.filter(x=>x.month===m&&inScope(x));
  const oldIds=new Map(old.map(x=>[String(x.id),x])),curIds=new Set(cur.map(x=>String(x.id)));
  const added=cur.filter(x=>!oldIds.has(String(x.id))),gone=old.filter(x=>!curIds.has(String(x.id)));
  const nights=cur.reduce((n,x)=>n+x.nights,0)-old.reduce((n,x)=>n+x.nights,0),gross=cur.reduce((n,x)=>n+x.gross,0)-old.reduce((n,x)=>n+x.gross,0);
  const pa=older.data.meta.as_of||older.id.slice(0,10);if(pa>prevAsOf)prevAsOf=pa;
  if(added.length||gone.length||nights||Math.abs(gross)>0.5)rows.push({month:m,added:added.length,gone:gone.length,nights,gross});
 }
 if(!prevAsOf){holder.innerHTML='';return}
 const sum=k=>rows.reduce((n,r)=>n+r[k],0),sign=v=>(v>0?'+':v<0?'−':'')+numeric(Math.abs(v));
 const money=v=>(v>0?'+':v<0?'−':'')+amount(Math.abs(v));
 const tile=(label,value,cls)=>`<div class="topline-tile ${cls||''}"><span>${safe(label)}</span><strong>${value}</strong></div>`;
 holder.innerHTML=`<div class="summary-top"><h2>Pickup · desde la carga del ${safe(new Date(prevAsOf).toLocaleDateString('es-ES'))}</h2><span class="mini">${safe(buildingLabel(building))}</span></div>
 ${rows.length?`<div class="topline-grid">${tile('Reservas nuevas',sign(sum('added')),sum('added')>0?'good':'')}${tile('Canceladas o retiradas',sum('gone')?'−'+numeric(sum('gone')):'0',sum('gone')>0?'bad':'')}${tile('Noches netas',sign(sum('nights')),sum('nights')>0?'good':sum('nights')<0?'bad':'')}${tile('PVP neto',money(sum('gross')),sum('gross')>0?'good':sum('gross')<0?'bad':'')}</div>
 <table class="detail-table"><thead><tr><th>Mes</th><th>Nuevas</th><th>Canceladas / retiradas</th><th>Noches</th><th>PVP</th></tr></thead><tbody>${rows.slice(0,8).map(r=>`<tr><td>${safe(r.month)}</td><td>${r.added}</td><td>${r.gone}</td><td>${safe(sign(r.nights))}</td><td>${safe(money(r.gross))}</td></tr>`).join('')}</tbody></table>`:'<p class="note">Sin cambios en los meses desde la última carga.</p>'}
 <p class="note">Compara la última carga con la anterior de cada mes, desde el mes de la última carga en adelante. Una reserva que estaba y ya no aparece se cuenta como cancelada o retirada; los cambios de importe entran en el PVP neto.</p>`;
}
const olderRender=render;render=function(){olderRender();renderEvolutionMain();renderPickup();compareCharts();renderKpi();renderHighlights();renderTopline();renderContextLine();renderSnapshotBanner()};
})();
