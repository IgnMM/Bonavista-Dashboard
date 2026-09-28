/* Month-to-date pace, prior-year full-month benchmark and rolling twelve-month metrics. */
(function(){
'use strict';
const KEYS=['gross','nights','bookings','guestsTotal','guestsKnown','leadTotal','rentalNet'];
const DIMS=['channel','rate','country','guests','stay','lead','arrival'];
function empty(){return {gross:0,nights:0,bookings:0,guestsTotal:0,guestsKnown:0,leadTotal:0,rentalNet:0,categories:Object.fromEntries(DIMS.map(k=>[k,{}]))}}
function add(a,b){if(!b)return a;for(const key of KEYS)a[key]+=Number(b[key]||0);for(const dim of DIMS)for(const [name,entry] of Object.entries(b.categories?.[dim]||{})){const t=a.categories[dim][name]??={gross:0,count:0,nights:0};for(const k of ['gross','count','nights'])t[k]+=Number(entry[k]||0)}return a}
function current(month,building){const a=empty();for(const x of latest()){if(x.month!==month||(building&&x.building!==building))continue;a.gross+=x.gross||0;a.nights+=x.nights||0;a.bookings++;a.rentalNet+=(x.rental||0)-(x.discount||0);a.leadTotal+=x.lead||0;if(x.guests!==null&&Number.isFinite(x.guests)){a.guestsTotal+=x.guests;a.guestsKnown++}const stay=x.nights<=2?'1–2 noches':x.nights<=4?'3–4 noches':x.nights<=7?'5–7 noches':'8+ noches',lead=x.lead<=7?'0–7 días':x.lead<=30?'8–30 días':x.lead<=90?'31–90 días':'Más de 90 días';for(const [dim,name] of Object.entries({channel:x.channel,rate:x.rate,country:x.country,guests:x.guests===null?'Sin dato':String(x.guests),stay,lead,arrival:x.arrival})){const t=a.categories[dim][name||'Sin dato']??={gross:0,count:0,nights:0};t.gross+=x.gross||0;t.count++;t.nights+=x.nights||0}}return a}
function historic(month,building,day){const a=empty();for(const row of historical?.rows||[]){if(row.month!==month||(building&&row.building!==building)||!row.analysis)continue;if(day===undefined)add(a,row.analysis);else{add(a,row.analysisBeforeMonth);for(const [d,delta] of Object.entries(row.analysisDailyIncrements||{}))if(Number(d)<=day)add(a,delta)}}return a}
function hasHistory(month,building){return !!historical?.rows?.some(x=>x.month===month&&(!building||x.building===building)&&x.analysis)}
const amount=v=>new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(v);
const numeric=v=>new Intl.NumberFormat('es-ES',{maximumFractionDigits:1}).format(v);
const percent=v=>new Intl.NumberFormat('es-ES',{style:'percent',maximumFractionDigits:1}).format(v);
function monthEarlier(month,delta){const [y,m]=month.split('-').map(Number),d=new Date(Date.UTC(y,m-1+delta,1));return d.toISOString().slice(0,7)}
function reportCurrentMonth(){return new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit'}).format(new Date())}
function asOfDay(month){const iso=window.PORTFOLIO_ASOF?.[month]||payload?.meta?.as_of||new Date().toISOString().slice(0,10);return Math.max(1,Math.min(31,Number(iso.slice(8,10))||1))}
function bars(title,entries,formatter=amount){const rows=entries.slice(0,title.startsWith('Producción por día')?31:title.startsWith('Producción PVP mensual')?12:10),max=Math.max(1,...rows.flatMap(x=>x.values).filter(x=>x!==null).map(x=>x||0));return `<div class="panel comparison-card ${title.startsWith('Producción por día')?'daily-comparison':''}"><h2>${safe(title)}</h2>${rows.length?`<div class="comparison-head"><span></span><span>Actual</span><span>Año ant. a fecha</span><span>Año ant. cierre</span></div>${rows.map(({label,values})=>`<div class="comparison-row"><b title="${safe(label)}">${safe(label)}</b>${values.map((v,i)=>`<span title="${safe(label)} · ${['Actual','Año anterior a fecha','Año anterior cierre'][i]}: ${v===null?'sin dato':safe(formatter(v))}"><em class="cmp-track"><i class="cmp-fill cmp-${i}" style="width:${v===null?0:Math.max(1,v/max*100)}%"></i></em><strong>${v===null?'—':safe(formatter(v))}</strong></span>`).join('')}</div>`).join('')}`:'<p class="note">Sin datos para este gráfico.</p>'}</div>`}
function compareCharts(){if(!payload)return;const building=$('building').value,selected=$('month').value,month=selected||[...new Set(latest().map(x=>x.month))].sort().at(-1);if(!month)return;const previous=monthEarlier(month,-12),day=asOfDay(month);if(!hasHistory(previous,building)){$('charts').innerHTML='<div class="panel"><h2>Comparación de gráficos</h2><p class="note">Importa el histórico analítico agregado para comparar todas las series con el año anterior.</p></div>';return}
 const now=current(month,building),openMonth=month===reportCurrentMonth(),cut=openMonth?historic(previous,building,day):null,prior=historic(previous,building);
 const series=(dim,metric,ratio=false)=>{const normalize=source=>{if(!source)return null;if(dim!=='arrival')return source;const byDay={};for(const [key,value] of Object.entries(source)){const day=key.slice(-2),target=byDay[day]??={gross:0,count:0,nights:0};for(const k of ['gross','count','nights'])target[k]+=value[k]||0}return byDay};const a=normalize(now.categories[dim]),b=normalize(cut?.categories[dim]),c=normalize(prior.categories[dim]),keys=[...new Set([...Object.keys(a),...Object.keys(b||{}),...Object.keys(c)])];const value=(o,key,total)=>{if(!o)return null;const v=o[key]?.[metric]||0;return ratio?total?100*v/total:0:v};return keys.map(key=>({label:dim==='arrival'?key.slice(-2):key,values:[value(a,key,now.bookings),value(b,key,cut?.bookings||0),value(c,key,prior.bookings)],rank:(value(a,key,now.bookings)||0)+(value(c,key,prior.bookings)||0)})).sort((x,y)=>y.rank-x.rank)};
 const months=Array.from({length:12},(_,i)=>{const m=month.slice(0,4)+'-'+String(i+1).padStart(2,'0'),p=monthEarlier(m,-12),exists=latest().some(x=>x.month===m);return {label:m.slice(5),values:[exists?current(m,building).gross:null,m===reportCurrentMonth()&&hasHistory(p,building)?historic(p,building,asOfDay(m)).gross:null,hasHistory(p,building)?historic(p,building).gross:null]}});
 const arrivals=series('arrival','gross').map(x=>({label:x.label,values:x.values})).sort((a,b)=>Number(a.label)-Number(b.label));
 const cancelPrior=historical.rows.filter(x=>x.month===previous&&(!building||x.building===building)).reduce((s,x)=>s+Number(x.cancelledNights||0),0);
 const canceled=model.cancelled===null?null:Number(model.cancelled);
 $('charts').innerHTML=[bars('Producción PVP mensual · '+month.slice(0,4),months,amount),bars('Producción por día de llegada · '+month,arrivals,amount),bars('Canales · PVP',series('channel','gross'),amount),bars('Estancia · reservas',series('stay','count'),numeric),bars('Ocupantes · reservas',series('guests','count'),numeric),bars('Países · % reservas',series('country','count',true),v=>numeric(v)+' %'),bars('Tarifas · PVP',series('rate','gross'),amount),bars('Antelación · reservas',series('lead','count'),numeric),bars('Noches por edificio',[...new Set([...latest().filter(x=>x.month===month).map(x=>x.building),...historical.rows.filter(x=>x.month===previous).map(x=>x.building)])].filter(x=>!building||x===building).map(name=>({label:name.replace('Bonavista ',''),values:[current(month,name).nights,openMonth?historic(previous,name,day).nights:null,historic(previous,name).nights]})),numeric),bars('Cancelaciones · noches',[{label:'Canceladas',values:[canceled,null,cancelPrior]},{label:'Confirmadas',values:[now.nights,cut?.nights??null,prior.nights]}],numeric)].join('')+`<p class="note comparison-foot">${safe(month)} frente a ${safe(previous)}. Solo el mes en curso usa una comparación al mismo día. Para meses cerrados, ambas cifras son de cierre completo. «Año ant. a fecha» es una reconstrucción desde fecha de reserva y estado final al día ${day}; no recupera modificaciones ni cancelaciones históricas. Las series del año actual proceden de las cargas presentes. Cancelaciones actuales: ${canceled===null?'sin exportación':'hipótesis editable'}. Los países representan porcentaje de reservas.</p>`;
}
function completeMonth(month,building){if(month>=reportCurrentMonth())return null;if(latest().some(x=>x.month===month&&(!building||x.building===building)))return current(month,building);return hasHistory(month,building)?historic(month,building):null}
function trailing(end,building){const a=empty();for(let i=11;i>=0;i--){const one=completeMonth(monthEarlier(end,-i),building);if(!one)return null;add(a,one)}return a}
const PACE_KEYS=[['gross','Producción PVP',v=>amount(v)],['nights','Noches reservadas',v=>numeric(v)],['count','Reservas',v=>numeric(v)],['stay','Estancia media',v=>numeric(v)+' noches'],['guests','Ocupantes medios',v=>numeric(v)],['lead','Antelación',v=>numeric(v)+' días'],['direct','Venta directa',v=>percent(v)],['occupancy','Ocupación',v=>percent(v)],['adr','ADR sin IVA',v=>amount(v)],['revpar','RevPAR sin IVA',v=>amount(v)],['cancel','Cancelaciones',v=>percent(v)]];
const PACE_RATIO_KEYS=new Set(['direct','occupancy','cancel']);
function monthlyValue(m,building,key){
 const prev=monthEarlier(m,-12),loaded=latest().some(x=>x.month===m&&(!building||x.building===building)),hasHist=hasHistory(prev,building),date=asOfDay(m);
 let now=null;
 if(key==='cancel'){now=m===reportCurrentMonth()&&model.cancelled!==null?Number(model.cancelled)/(Number(model.cancelled)+current(m,building).nights||1):null}
 else if(loaded){now=['occupancy','adr','revpar'].includes(key)?metrics(m,building)[key]:detailMetric(current(m,building),key,m,building)}
 let cut=null;
 if(m===reportCurrentMonth()&&hasHist&&key!=='cancel')cut=detailMetric(historic(prev,building,date),key,prev,building);
 let final=null;
 if(hasHist){
  if(key==='cancel'){const canceled=historical.rows.filter(x=>x.month===prev&&(!building||x.building===building)).reduce((n,x)=>n+Number(x.cancelledNights||0),0),confirmed=historic(prev,building).nights;final=(canceled+confirmed)>0?canceled/(canceled+confirmed):null}
  else final=detailMetric(historic(prev,building),key,prev,building);
 }
 return{now,cut,final};
}
function renderPaceMonthly(){const holder=$('paceMonthly');if(!holder||!payload)return;const selected=$('month').value||[...new Set(latest().map(x=>x.month))].sort().at(-1);if(!selected)return;const year=Number(selected.slice(0,4)),building=$('building').value;const choice=holder.querySelector('#paceMeasure')?.value||'gross';const [,title,format]=PACE_KEYS.find(k=>k[0]===choice)||PACE_KEYS[0];const isRatio=PACE_RATIO_KEYS.has(choice);const months=Array.from({length:12},(_,i)=>{const m=year+'-'+String(i+1).padStart(2,'0'),v=monthlyValue(m,building,choice);return {month:m,values:[v.now,v.cut,v.final]}});const max=Math.max(1,...months.flatMap(m=>m.values.map(v=>isRatio?(v||0)*100:v)).filter(v=>v!==null));const diffLine=(v,ref)=>v===null||ref===null?null:v-ref;const shortNumber=v=>{const abs=Math.abs(v);if(abs>=1e6)return(v/1e6).toFixed(2).replace('.',',')+'M';if(abs>=1e3)return String(Math.round(v/1e3))+'k';return String(Math.round(v))};const isMoney=['gross','adr','revpar'].includes(choice);const compact=v=>v===null?'—':isMoney?shortNumber(v)+' €':format(v);const barHeight=v=>v===null?0:Math.max(2,125*(isRatio?v*100:v)/max);
holder.innerHTML=`<div class="pace-month-title"><div><div class="mini">MES A MES · MESES CERRADOS; MES ACTUAL A FECHA</div><h3>${safe(title)} · ${year} frente a ${year-1}</h3></div><label>Indicador <select id="paceMeasure">${PACE_KEYS.map(([k,label])=>`<option value="${k}" ${choice===k?'selected':''}>${safe(label)}</option>`).join('')}</select></label></div><div class="pace-month-legend"><span><i class="cmp-0"></i>${year} cierre salvo mes actual</span><span><i class="cmp-1"></i>${year-1} al mismo día (mes actual)</span><span><i class="cmp-2"></i>${year-1} cierre completo</span><span><i class="cmp-target"></i>Techo ${year-1} (solo mes en curso)</span></div><p class="note">El recuadro rojo marca el mes en curso según la fecha de hoy.</p><div class="pace-month-grid">${months.map(({month,values})=>{const isCurrent=month===reportCurrentMonth();const prevMonth=String(Number(month.slice(0,4))-1)+month.slice(4);const refHeight=isCurrent&&values[2]!==null?barHeight(values[2]):null;const barIndices=(isCurrent?[0,1]:[0,2]).filter(i=>values[i]!==null);const ceiling=`<div class="pace-month-ceiling">${isCurrent&&values[2]!==null?`<em>Cierre ${safe(prevMonth)}</em>${safe(compact(values[2]))}`:''}</div>`;const vsAA=isCurrent?diffLine(values[0],values[1]):diffLine(values[0],values[2]);const vsAAtext=vsAA===null?'—':isRatio?('vs AA: '+(vsAA>=0?'+':'')+numeric(vsAA*100)+' p.p.'):('vs AA: '+(vsAA>=0?'+':'')+percent(vsAA/(isCurrent?values[1]:values[2])));return `<div class="pace-month ${isCurrent?'current':''}" title="${safe(month)}: ${values.map(v=>v===null?'sin carga':format(v)).join(' / ')}">${ceiling}<div class="pace-month-bars">${refHeight!==null?`<div class="pace-month-target" style="bottom:${refHeight}px"></div>`:''}${barIndices.map(i=>{const h=barHeight(values[i]);return `<div class="pace-month-barwrap"><span class="pace-month-barlabel" style="bottom:${h+3}px">${safe(compact(values[i]))}</span><div class="pace-month-bar cmp-${i}" style="height:${h}px"></div></div>`}).join('')}</div><b>${safe(month.slice(5))}</b><small>${safe(vsAAtext)}</small></div>`}).join('')}</div><table class="pace-month-table"><thead><tr><th>Mes</th><th>${safe(title)} ${year}</th><th>Cierre ${year-1}</th><th>Diferencia</th><th>Diferencia %</th></tr></thead><tbody>${months.map(({month,values})=>{const diff=diffLine(values[0],values[2]);const diffText=diff===null?'—':isRatio?((diff>=0?'+':'')+numeric(diff*100)+' p.p.'):((diff>=0?'+':'')+format(diff));const diffPctText=diff===null||isRatio||!values[2]?'—':((diff>=0?'+':'')+percent(diff/values[2]));return `<tr class="${month===selected?'chosen':''}"><td>${safe(month)}</td><td>${values[0]===null?'—':safe(format(values[0]))}</td><td>${values[2]===null?'—':safe(format(values[2]))}</td><td>${safe(diffText)}</td><td>${safe(diffPctText)}</td></tr>`}).join('')}</tbody></table><p class="note">Un mes sin carga figura como «—». Solo en el mes en curso, el año anterior al mismo día se reconstruye con la fecha de reserva y el estado final, sin histórico de cambios de importe ni cancelaciones. La línea discontinua marca el cierre de ${year-1} como referencia del mes. ADR, ocupación, RevPAR y venta directa son estimaciones sujetas a las hipótesis editables.</p>`;holder.querySelector('#paceMeasure')?.addEventListener('change',renderPaceMonthly)}
function matCurve(building,metric,format,fn){const months=[...new Set([...(historical?.rows||[]).map(x=>x.month),...latest().map(x=>x.month)])].sort(),points=months.map(month=>({month,stats:trailing(month,building)})).filter(x=>x.stats).slice(-24),values=points.map(x=>fn(x.stats)),max=Math.max(1,...values.filter(x=>x!==null));return `<div class="mat-curve">${points.map(({month},i)=>{const v=values[i];return `<div class="mat-point" title="${safe(month)}: ${v===null?'sin dato':safe(format(v))}"><strong>${v===null?'—':safe(format(v))}</strong><div class="mat-track"><i style="height:${v===null?0:Math.max(2,v/max*88)}px"></i></div><span>${safe(month)}</span></div>`}).join('')}</div><p class="note">Cada barra agrega los 12 meses anteriores hasta el mes indicado. No se trazan periodos que carezcan de alguno de sus 12 meses.</p>`}
function renderMAT(){const target=$('rollingMAT');if(!target||!payload)return;if(!historical?.rows?.some(x=>x.analysis)){target.innerHTML='<p class="note">Importa el histórico analítico para calcular los últimos 12 meses completos.</p>';return}const building=$('building').value,months=[...new Set([...(historical.rows||[]).map(x=>x.month),...latest().map(x=>x.month)])].sort().reverse();let end,now,prev;for(const m of months){const a=trailing(m,building),b=trailing(monthEarlier(m,-12),building);if(a&&b){end=m;now=a;prev=b;break}}if(!end){target.innerHTML='<p class="note">Todavía no hay dos ventanas consecutivas de 12 meses con datos para comparar.</p>';return}const direct=new Set(String(model.direct||'').split(',').map(x=>x.trim().toLowerCase()));const share=x=>x.gross?Object.entries(x.categories.channel).reduce((n,[key,v])=>n+(direct.has(key.toLowerCase())?v.gross:0),0)/x.gross:null;const cases=[['Producción PVP',x=>x.gross,amount],['Noches reservadas',x=>x.nights,numeric],['Reservas',x=>x.bookings,numeric],['Estancia media',x=>x.bookings?x.nights/x.bookings:null,x=>numeric(x)+' noches'],['Ocupantes medios',x=>x.guestsKnown?x.guestsTotal/x.guestsKnown:null,numeric],['Antelación',x=>x.bookings?x.leadTotal/x.bookings:null,x=>numeric(x)+' días'],['Venta directa',share,percent],['ADR alquiler sin IVA*',x=>x.nights?x.rentalNet/(1+Number(model.vat||0)/100)/x.nights:null,amount]];
 target.innerHTML=`<div class="summary-top"><div><div class="mini">TAM · ÚLTIMOS 12 MESES</div><h2>Cierre a ${safe(end)} frente al TAM anterior</h2></div><span class="mini">${safe(building||'Todos los edificios')}</span></div><div class="mat-grid">${cases.map(([label,fn,format])=>{const a=fn(now),b=fn(prev);return `<div class="mat-cell"><span>${safe(label)}</span><strong>${a===null?'—':safe(format(a))}</strong><small>Anterior: ${b===null?'—':safe(format(b))}${a!==null&&b!==null&&b!==0?' · '+safe(percent((a-b)/b)):' '}</small></div>`}).join('')}</div><div class="mat-curve-control"><label>Evolución TAM <select id="matMetric">${cases.map(([name],i)=>`<option value="${i}">${safe(name)}</option>`).join('')}</select></label></div><div id="matCurve"></div><p class="note">Ventanas: ${safe(monthEarlier(end,-11))}–${safe(end)} y ${safe(monthEarlier(end,-23))}–${safe(monthEarlier(end,-12))}. Si faltan meses de 2026, se muestra el último TAM completo disponible. Cada año puede tener distinto inventario; compara el mismo edificio para mantener el perímetro. *ADR estimado: alquiler menos descuento, IVA ${safe(model.vat||0)} %, dividido entre noches de reserva; pendiente de validación contable.</p>`;const picker=target.querySelector('#matMetric'),curve=target.querySelector('#matCurve');if(picker&&curve){const draw=()=>{const [name,fn,format]=cases[Number(picker.value)||0];curve.innerHTML=`<h3>${safe(name)} · evolución mensual del TAM</h3>`+matCurve(building,name,format,fn)};picker.addEventListener('change',draw);draw()}
}
function detailMetric(stats,key,month,building){if(!stats)return null;const units=building?[building]:[...new Set((historical?.rows||[]).filter(x=>x.month===month).map(x=>x.building))],available=units.reduce((n,b)=>n+(Number(model.units[b])||0)*new Date(Number(month.slice(0,4)),Number(month.slice(5,7)),0).getDate()-(Number(model.blocks?.[b])||0),0);const revenue=stats.rentalNet/(1+Number(model.vat||0)/100);const direct=new Set(String(model.direct||'').split(',').map(x=>x.trim().toLowerCase()));switch(key){case 'gross':return stats.gross;case 'count':return stats.bookings;case 'nights':return stats.nights;case 'stay':return stats.bookings?stats.nights/stats.bookings:null;case 'guests':return stats.guestsKnown?stats.guestsTotal/stats.guestsKnown:null;case 'lead':return stats.bookings?stats.leadTotal/stats.bookings:null;case 'direct':return stats.gross?Object.entries(stats.categories.channel).reduce((s,[name,value])=>s+(direct.has(name.toLowerCase())?value.gross:0),0)/stats.gross:null;case 'adr':return stats.nights?revenue/stats.nights:null;case 'occupancy':return available>0?stats.nights/available:null;case 'revpar':return available>0?revenue/available:null;default:return null}}
window.PERIOD_MODE=window.PERIOD_MODE||'month';
function periodMonths(){
 const anchor=$('month').value||[...new Set(latest().map(x=>x.month))].sort().at(-1);
 if(!anchor)return null;
 const mode=window.PERIOD_MODE||'month',isOpen=anchor===reportCurrentMonth();
 if(mode==='year'){const year=anchor.slice(0,4),upTo=Number(anchor.slice(5,7));return {months:Array.from({length:upTo},(_,i)=>year+'-'+String(i+1).padStart(2,'0')),anchor,isOpen,mode}}
 if(mode==='tam'){const end=isOpen?monthEarlier(anchor,-1):anchor;return {months:Array.from({length:12},(_,i)=>monthEarlier(end,-(11-i))),anchor:end,isOpen:false,mode}}
 return {months:[anchor],anchor,isOpen,mode};
}
window.periodMonths=periodMonths;
const PERIOD_LABELS={month:'Mes',year:'Acumulado año',tam:'TAM · últimos 12 meses'};
function ensurePeriodControl(){
 if($('periodTabs'))return;
 const filtersEl=document.querySelector('.filters');if(!filtersEl)return;
 const bar=document.createElement('div');bar.className='period-control';bar.id='periodTabs';
 bar.innerHTML='<div class="period-tabs" role="tablist">'+Object.entries(PERIOD_LABELS).map(([mode,label])=>`<button type="button" data-mode="${mode}">${safe(label)}</button>`).join('')+'</div><p class="note" id="periodLabel"></p>';
 filtersEl.parentNode.insertBefore(bar,filtersEl.nextSibling);
 bar.querySelectorAll('[data-mode]').forEach(btn=>btn.addEventListener('click',()=>{window.PERIOD_MODE=btn.dataset.mode;render()}));
}
function renderPeriodControl(){
 ensurePeriodControl();
 const mode=window.PERIOD_MODE||'month',p=periodMonths();
 document.querySelectorAll('#periodTabs [data-mode]').forEach(btn=>btn.classList.toggle('active',btn.dataset.mode===mode));
 const label=$('periodLabel');if(!label)return;
 if(!p){label.textContent='';return}
 const first=p.months[0],last=p.months.at(-1),range=p.months.length>1?`${first} a ${last}`:first;
 const coverage=p.months.filter(m=>latest().some(x=>x.month===m)).length;
 label.textContent=`${range} · ${coverage}/${p.months.length} meses con carga`+(p.isOpen?' · mes en curso, cifras a fecha de la última exportación':(mode!=='month'&&coverage<p.months.length?' · faltan meses por cargar':''));
}
function yearToDate(month,building,useHistoric,cutDay){
 const year=month.slice(0,4),upTo=Number(month.slice(5,7)),acc=empty(),monthsUsed=[];
 for(let m=1;m<=upTo;m++){const key=year+'-'+String(m).padStart(2,'0');
  if(useHistoric){if(hasHistory(key,building)){add(acc,(m===upTo&&cutDay!=null)?historic(key,building,cutDay):historic(key,building));monthsUsed.push(m)}}
  else if(latest().some(x=>x.month===key&&(!building||x.building===building))){add(acc,current(key,building));monthsUsed.push(m)}
 }
 return {stats:acc,monthsUsed};
}
const BASE_CARD_SPECS={gross:{now:x=>x.gross,fmt:amount},count:{now:x=>x.bookings,fmt:numeric},nights:{now:x=>x.nights,fmt:numeric},stay:{now:x=>x.bookings?x.nights/x.bookings:null,fmt:x=>numeric(x)+' noches'},guests:{now:x=>x.guestsKnown?x.guestsTotal/x.guestsKnown:null,fmt:numeric},lead:{now:x=>x.bookings?x.leadTotal/x.bookings:null,fmt:x=>numeric(x)+' días'}};
function annotateBaseCards(){
 if(!payload)return;
 renderPeriodControl();
 const building=$('building').value,mode=window.PERIOD_MODE||'month',p=periodMonths();
 const cards=[...document.querySelectorAll('#cards button.card')];
 if(!p)return;
 let now,before,label,coverageNote='';
 if(mode==='year'){
  const month=p.anchor,day=asOfDay(month);
  const cur=yearToDate(month,building,false),prevYearMonth=String(Number(month.slice(0,4))-1)+month.slice(4),pr=yearToDate(prevYearMonth,building,true,day);
  now=cur.stats;before=(cur.monthsUsed.length&&pr.monthsUsed.length&&cur.monthsUsed.length===pr.monthsUsed.length)?pr.stats:null;label='acumulado '+month.slice(0,4)+' a día '+day+' vs '+(Number(month.slice(0,4))-1)+' mismo acumulado';
  if(!before&&cur.monthsUsed.length&&pr.monthsUsed.length)coverageNote=' (cobertura insuficiente: '+cur.monthsUsed.length+' vs '+pr.monthsUsed.length+' meses acumulados, no comparable)';
 }else if(mode==='tam'){
  const end=p.anchor,prevEnd=monthEarlier(end,-12);
  now=trailing(end,building);before=trailing(prevEnd,building);
  label='TAM '+monthEarlier(end,-11)+' a '+end+' vs '+monthEarlier(prevEnd,-11)+' a '+prevEnd;
  if(now&&!before)coverageNote=' (sin ventana de 12 meses completa el año anterior)';
 }else{
  const month=p.anchor,day=asOfDay(month),prev=monthEarlier(month,-12);
  now=current(month,building);before=hasHistory(prev,building)?historic(prev,building,day):null;label=month+' a día '+day+' vs '+prev+' mismo día';
 }
 for(const card of cards){
  const match=card.getAttribute('onclick')?.match(/detail\('(\w+)'\)/),key=match?.[1],spec=BASE_CARD_SPECS[key];if(!spec)continue;
  if(mode==='tam'){
   const strong=card.querySelector('strong'),em=card.querySelector('em');
   if(strong)strong.textContent=now?(spec.now(now)===null?'—':safe(spec.fmt(spec.now(now)))):'—';
   if(em)em.textContent=now?'TAM móvil · cierra en '+p.anchor:'Faltan meses de los últimos 12 por cargar';
  }
  let node=card.querySelector('.yoy');if(!node){node=document.createElement('small');node.className='yoy';card.appendChild(node)}
  if(!now){node.textContent='TAM incompleto: faltan meses de los últimos 12 por cargar';continue}
  if(!before){node.textContent=coverageNote?'Sin comparar'+safe(coverageNote):'Sin comparación: importa el histórico agregado';continue}
  const a=spec.now(now),b=spec.now(before);
  node.textContent=(a===null||b===null||!b)?'Sin dato comparable ('+safe(label)+')':('vs AA: '+(a-b>=0?'+':'')+percent((a-b)/b));
 }
}
const PENDING_RATE_KEYS=new Set(['occupancy','direct','cancel']);
function annotatePendingCards(){
 if(!payload)return;
 const building=$('building').value,month=$('month').value||[...new Set(latest().map(x=>x.month))].sort().at(-1);
 if(!month)return;
 const prev=monthEarlier(month,-12),day=asOfDay(month),has=hasHistory(prev,building);
 const cards=[...document.querySelectorAll('#pending button[data-metric]')].filter(c=>['occupancy','adr','revpar','direct','cancel'].includes(c.dataset.metric));
 for(const card of cards){
  const key=card.dataset.metric;
  let node=card.querySelector('.yoy');if(!node){node=document.createElement('small');node.className='yoy';card.appendChild(node)}
  if(!has){node.textContent='Sin comparación: importa el histórico agregado';continue}
  let a,b;
  if(key==='cancel'){
   a=model.cancelled===null?null:Number(model.cancelled)/(Number(model.cancelled)+current(month,building).nights||1);
   const canceled=historical.rows.filter(x=>x.month===prev&&(!building||x.building===building)).reduce((n,x)=>n+Number(x.cancelledNights||0),0),confirmed=historic(prev,building).nights;
   b=(canceled+confirmed)>0?canceled/(canceled+confirmed):null;
  }else{
   a=metrics(month,building)[key];
   b=detailMetric(historic(prev,building,day),key,prev,building);
  }
  if(a===null||b===null){node.textContent='Sin dato comparable';continue}
  node.textContent=PENDING_RATE_KEYS.has(key)?('vs AA: '+((a-b)*100>=0?'+':'')+numeric((a-b)*100)+' p.p.'):('vs AA: '+(a-b>=0?'+':'')+percent((a-b)/b));
 }
}
function computeHighlights(){
 if(!payload)return[];
 const building=$('building').value,month=$('month').value||[...new Set(latest().map(x=>x.month))].sort().at(-1);
 if(!month)return[];
 const rows=subset(),bullets=[];
 const share=(key)=>{const totals={};for(const r of rows)totals[r[key]]=(totals[r[key]]||0)+r.gross;const total=rows.reduce((s,r)=>s+r.gross,0)||1;const sorted=Object.entries(totals).sort((a,b)=>b[1]-a[1]);return sorted.length?{name:sorted[0][0],pct:sorted[0][1]/total}:null};
 if(!building){const top=share('building');if(top)bullets.push({text:`${top.name} lidera la producción con ${percent(top.pct)} del total del periodo.`,kind:'info'})}
 const topChannel=share('channel');if(topChannel)bullets.push({text:`${topChannel.name} es el canal con más producción: ${percent(topChannel.pct)} del PVP.`,kind:'info'});
 const prev=monthEarlier(month,-12),day=asOfDay(month);
 if(hasHistory(prev,building)){
  const now=current(month,building),before=historic(prev,building,day);
  if(before.gross>0){const delta=(now.gross-before.gross)/before.gross;bullets.push({text:`Producción PVP ${delta>=0?'sube':'baja'} un ${percent(Math.abs(delta))} frente al mismo día del año anterior.`,kind:delta>=0?'good':'bad'})}
  const leadNow=now.bookings?now.leadTotal/now.bookings:null,leadBefore=before.bookings?before.leadTotal/before.bookings:null;
  if(leadNow!==null&&leadBefore>0){const d=(leadNow-leadBefore)/leadBefore;if(Math.abs(d)>=0.1)bullets.push({text:`La antelación media ${d>=0?'sube':'baja'} un ${percent(Math.abs(d))}: reservas ${d>=0?'con más':'de más última hora'} respecto al año anterior.`,kind:'info'})}
 }
 if(payload.meta.reconciliation_warnings>0)bullets.push({text:`${payload.meta.reconciliation_warnings} reserva(s) con el total PVP sin conciliar del todo con el CSV de servicios.`,kind:'warn'});
 if(payload.meta.channel_coverage<payload.meta.reservations)bullets.push({text:`${payload.meta.reservations-payload.meta.channel_coverage} reserva(s) sin canal identificado.`,kind:'warn'});
 const m=metrics(month,building);
 if(m.occupancy!==null&&m.occupancy>1)bullets.push({text:'La ocupación estimada supera el 100 % — revisa el inventario de apartamentos y los bloqueos.',kind:'warn'});
 return bullets.slice(0,6);
}
function renderHighlights(){
 const holder=$('highlights');if(!holder)return;
 const bullets=computeHighlights();
 holder.innerHTML=bullets.length?`<h2>Lo más destacado</h2><ul class="highlights-list">${bullets.map(b=>`<li class="hl-${b.kind}">${safe(b.text)}</li>`).join('')}</ul><p class="note">Generado con reglas a partir de los datos cargados en este navegador; no es un resumen redactado por IA.</p>`:'';
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
function toplineTile(label,value,fmt,delta,ppMode){
 const deltaText=delta===null?'Sin comparación: importa el histórico':(ppMode?`${(delta*100)>=0?'+':''}${numeric(delta*100)} p.p. vs AA`:`${delta>=0?'+':''}${percent(delta)} vs AA`);
 const cls=delta===null?'':(delta>=0?'good':'bad');
 return `<div class="topline-tile ${cls}"><span>${safe(label)}</span><strong>${value===null||value===undefined?'—':safe(fmt(value))}</strong><small>${deltaText}</small></div>`;
}
function renderTopline(){
 const holder=$('topline');if(!holder)return;
 if(!payload){holder.innerHTML='';return}
 const building=$('building').value,month=reportCurrentMonth();
 const hasCurrent=latest().some(x=>x.month===month&&(!building||x.building===building));
 const lastLoadedMonth=[...new Set(latest().map(x=>x.month))].sort().at(-1);
 if(!hasCurrent){
  holder.innerHTML=`<div class="mini">PULSO DEL MES · NO CAMBIA CON EL ANÁLISIS DE ABAJO</div><h2>${safe(month)} · ${safe(building||'Todos los edificios')}</h2><p class="note">Sin carga del mes en curso todavía${lastLoadedMonth?'; última carga disponible: '+safe(lastLoadedMonth):''}. Sube la exportación de ${safe(month)} con «Actualizar dashboard» para ver aquí el pulso del mes actual.</p>`;
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
 holder.innerHTML=`<div class="summary-top"><div><div class="mini">PULSO DEL MES · NO CAMBIA CON EL ANÁLISIS DE ABAJO</div><h2>${safe(month)} · ${safe(building||'Todos los edificios')}</h2></div><span class="mini">Datos a ${safe(asOf?new Date(asOf).toLocaleDateString('es-ES'):'—')}</span></div>
 ${priorClose?`<div class="pace-goal"><span>CIERRE ${safe(prev)} · REFERENCIA A ALCANZAR</span><strong>${safe(amount(priorClose))}</strong><div class="pace-goal-progress"><i style="width:${Math.min(100,Math.max(0,progress||0))}%"></i></div><small>${progress===null?'Sin referencia':safe(String(progress)+' % del cierre anterior')} · diferencia ${safe(amount((pvp.now||0)-priorClose))}</small></div>`:''}
 <div class="topline-grid">
  ${toplineTile('Producción PVP en cartera · día '+day,pvp.now,amount,pvpDelta)}
  ${toplineTile('Ocupación estimada del mes',occ.now,percent,occDelta,true)}
  ${toplineTile('ADR sin IVA (estimado)',adr.now,amount,adrDelta)}
  ${toplineTile('RevPAR sin IVA (estimado)',revpar.now,amount,revparDelta)}
 </div><p class="note">La cifra del año anterior al mismo día es una reconstrucción desde fecha de reserva y estado final; no recupera cancelaciones ni cambios de importe posteriores. Ocupación, ADR y RevPAR dependen de las hipótesis editables más abajo. El acumulado del año está en «Análisis del negocio», con Acumulado año.</p>`;
}
const olderRender=render;render=function(){olderRender();renderPaceMonthly();compareCharts();renderMAT();annotateBaseCards();annotatePendingCards();renderHighlights();renderTopline()};
})();
