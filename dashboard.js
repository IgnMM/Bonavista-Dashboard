
let payload=null;const $=id=>document.getElementById(id);const euro=n=>new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(n);const fmt=n=>new Intl.NumberFormat('es-ES',{maximumFractionDigits:1}).format(n);const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
window.SELECTED_BUILDINGS=new Set();
function matchBuilding(name,building){return !building||(building instanceof Set?building.has(name):name===building)}
function selectedBuilding(){return window.SELECTED_BUILDINGS.size?window.SELECTED_BUILDINGS:''}
function buildingLabel(building){if(!building)return'Todos los edificios';const names=[...building];return names.length===1?names[0]:names.length+' edificios seleccionados'}
function updateBuildingTrigger(){const t=$('buildingTrigger');if(t)t.textContent=buildingLabel(selectedBuilding())}
function syncBuildingSelect(){for(const opt of $('building').options)opt.selected=window.SELECTED_BUILDINGS.has(opt.value);$('building').dispatchEvent(new Event('change'))}
function buildingsEqual(a,b){const ka=a?[...a].sort().join(','):'',kb=b?[...b].sort().join(','):'';return ka===kb}
function openMonthFromChart(month){$('month').value=month;render();document.getElementById('paceMonthly')?.scrollIntoView({behavior:'smooth',block:'nearest'})}
function renderPeriodInfo(){
 const holder=$('periodInfo');if(!holder)return;
 const p=window.periodMonths?window.periodMonths():null;if(!p){holder.textContent='';return}
 const mode=window.PERIOD_MODE||'month',modeLabels={month:'Mes',year:'Acumulado año',tam:'TAM'};
 const custom=!!$('month').value;
 holder.innerHTML=modeLabels[mode]+' · '+escape(p.anchor)+(custom?' <button type="button" class="reset-period" id="resetPeriod">Volver al mes más reciente</button>':'');
 $('resetPeriod')?.addEventListener('click',()=>{$('month').value='';render()});
}
async function exitSnapshotView(){window.VIEWING_SNAPSHOT=null;await refreshPortfolio();const items=await listSnapshots();if(items.length)payload=items[0].data;setupFilters(payload);render()}
function renderSnapshotBanner(){
 const holder=$('snapshotBanner');if(!holder)return;
 if(!window.VIEWING_SNAPSHOT){holder.classList.add('hidden');holder.innerHTML='';return}
 holder.classList.remove('hidden');
 holder.innerHTML='Viendo la carga guardada del '+new Date(window.VIEWING_SNAPSHOT).toLocaleString('es-ES')+': así se veía la cartera en ese momento, no necesariamente cómo se ve ahora. <button type="button" class="ghost" id="exitSnapshot">Volver a la vista actual</button>';
 $('exitSnapshot').onclick=()=>exitSnapshotView();
}

$('load').onclick=async()=>{const a=$('bookings').files[0],b=$('services').files[0];if(!a||!b){$('status').textContent='Selecciona los dos archivos de la misma exportación.';return} window.VIEWING_SNAPSHOT=null;$('status').textContent='Validando los archivos…';$('dashboard').classList.add('hidden');try{const data=await analyseFiles(a,b);payload=data;let saved=true;let isNew=true;try{isNew=await saveSnapshot(data,a.name,b.name)}catch(err){saved=false}setupFilters(data);$('dashboard').classList.remove('hidden');$('status').textContent=(saved?(isNew?'Nueva captura guardada: ':'Captura idéntica a otra ya guardada; sin duplicar: '):'Importación mostrada sin guardar; el navegador bloqueó el almacenamiento local: ')+data.meta.reservations+' reservas y '+data.meta.service_lines+' líneas de servicios.';render()}catch(e){$('status').textContent='Error: '+e.message}};
$('building').onchange=()=>render();$('month').onchange=()=>render();
document.querySelector('.settings-link')?.addEventListener('click',e=>{e.preventDefault();$('settings').open=true;$('settings').scrollIntoView({behavior:'smooth',block:'start'})});
$('openSnapshot').onclick=async()=>{const id=$('snapshots').value;if(!id)return;const record=(await listSnapshots()).find(x=>x.id===id);if(!record)return;payload=record.data;window.PORTFOLIO_BOOKINGS=record.data.bookings;window.PORTFOLIO_ASOF=Object.fromEntries([...new Set(record.data.bookings.map(x=>x.month))].map(month=>[month,record.data.meta.as_of||id.slice(0,10)]));window.VIEWING_SNAPSHOT=id;setupFilters(payload);$('dashboard').classList.remove('hidden');$('status').textContent='Carga del '+new Date(id).toLocaleString('es-ES')+' · '+record.bookName;render()};
$('backup').onclick=()=>exportSnapshots().catch(e=>$('status').textContent=e.message);
$('restoreBackup').addEventListener('change',async event=>{const file=event.target.files[0];if(!file)return;try{const result=await restoreSnapshots(file);$('status').textContent=`Copia incorporada: ${result.added} cargas y ${result.marketAdded} observaciones de mercado nuevas. Los datos previos se conservan.`;if(payload){setupFilters(payload);render()}}catch(e){$('status').textContent='No se pudo recuperar la copia: '+e.message}event.target.value=''});
refreshSnapshots().catch(e=>$('status').textContent='No se puede acceder al almacenamiento local: '+e.message);
renderLastBackup();
(async()=>{try{const items=await listSnapshots();if(!items.length)return;await refreshPortfolio();if(!window.PORTFOLIO_BOOKINGS.length)return;payload=items[0].data;setupFilters(payload);$('dashboard').classList.remove('hidden');$('status').textContent='Cargado automáticamente con lo guardado en este navegador ('+items.length+' capturas). Sube un archivo solo para añadir un mes nuevo o actualizar el mes en curso.';render()}catch(e){}})();
function subset(){const p=window.periodMonths?window.periodMonths():null,months=p?new Set(p.months):null,building=selectedBuilding();return (window.PORTFOLIO_BOOKINGS?.length?window.PORTFOLIO_BOOKINGS:payload.bookings).filter(x=>(!building||matchBuilding(x.building,building))&&(!months||months.has(x.month)))}
function distribution(rows,key,element,measure='gross',limit=10,pctOnly=false){const sums={};for(const r of rows)sums[r[key]]=(sums[r[key]]||0)+(measure==='count'?1:r[measure]);const entries=Object.entries(sums).sort((a,b)=>b[1]-a[1]).slice(0,limit),max=entries[0]?.[1]||1,total=rows.reduce((s,r)=>s+(measure==='count'?1:r[measure]),0)||1;const showPct=pctOnly||(window.SALES_VIEW_MODE||'eur')==='pct';$(element).innerHTML=entries.length?entries.map(([name,n])=>`<div class="barrow"><span title="${escape(name)}">${escape(name.length>22?name.slice(0,20)+'…':name)}</span><div class="track"><div class="fill" style="width:${Math.max(1,100*n/max)}%"></div></div><span class="right">${showPct?fmt(n/total*100)+' %':euro(n)}</span></div>`).join(''):'<p class="note">Sin datos para el filtro seleccionado.</p>'}
function renderSalesExtras(rows){
 const gross=rows.reduce((a,b)=>a+b.gross,0),n=rows.length;
 $('salesViewBase').textContent='Base: '+euro(gross)+' en '+fmt(n)+' reservas del periodo elegido.';
 const direct=new Set((model?.direct||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean));
 const directGross=rows.filter(x=>direct.has(x.channel.toLowerCase())).reduce((a,b)=>a+b.gross,0);
 $('directNote').textContent=gross?'Venta directa: '+fmt(directGross/gross*100)+' % del canal.':'';
 const cancelKnown=typeof model!=='undefined'&&model.cancelled!==null;
 $('ritmoNote').textContent=cancelKnown?'':'Ritmo de reservas: cancelaciones y pickup sin datos todavía; se completará con la exportación de canceladas y una segunda captura del mismo mes.';
}
function render(){const rows=subset(),n=rows.length,nights=rows.reduce((a,b)=>a+b.nights,0);$('coverage').textContent=n+' reservas · '+(nights?fmt(nights)+' noches':'sin noches');$('printMeta').textContent='Periodo: '+($('month').value||'mes más reciente')+' · Edificio: '+buildingLabel(selectedBuilding())+' · Reservas: '+n+' · Elaborado: '+new Date().toLocaleDateString('es-ES');distribution(rows,'channel','channels');distribution(rows,'building','buildings');distribution(rows,'country','countries','count',10,true);distribution(rows,'rate','rates');distribution(rows,'roomType','roomtypes');renderSalesExtras(rows);$('quality').textContent=`Datos de origen: ${payload.meta.channel_coverage}/${payload.meta.reservations} reservas con canal; ${payload.meta.excluded_reservations||0} reservas no confirmadas excluidas; ${payload.meta.date_warnings} diferencias entre fechas y noches; ${payload.meta.reconciliation_warnings} reservas cuyo total PVP no coincide con los conceptos del CSV menos el descuento registrado. Consultar a Pablo cualquier diferencia restante. La producción está agrupada provisionalmente por mes de llegada.`;$('detailOverlay').classList.add('hidden')}
$('salesViewMode')?.addEventListener('change',()=>{window.SALES_VIEW_MODE=$('salesViewMode').value;render()});
$('detailClose')?.addEventListener('click',()=>$('detailOverlay').classList.add('hidden'));
$('detailOverlay')?.addEventListener('click',e=>{if(e.target.id==='detailOverlay')$('detailOverlay').classList.add('hidden')});
document.addEventListener('keydown',e=>{if(e.key==='Escape')$('detailOverlay')?.classList.add('hidden')});
function detail(key){const rows=subset(),months=[...new Set(rows.map(x=>x.month))].sort();const labels={gross:'Ventas PVP',count:'Reservas',nights:'Noches reservadas',stay:'Estancia media',guests:'Ocupantes medios',lead:'Antelación media'};let html='<h2>'+labels[key]+' · evolución por mes de llegada</h2>';for(const m of months){const group=rows.filter(x=>x.month===m),n=group.length,total=k=>group.reduce((s,x)=>s+x[k],0),known=group.filter(x=>x.guests!==null);let v={gross:euro(total('gross')),count:fmt(n),nights:fmt(total('nights')),stay:fmt(total('nights')/n)+' noches',guests:known.length?fmt(known.reduce((s,x)=>s+x.guests,0)/known.length):'—',lead:fmt(total('lead')/n)+' días'}[key];html+=`<div class="barrow"><span>${escape(m)}</span><span></span><b class="right">${v}</b></div>`}html+='<p class="note">Periodo atribuido a la llegada. La comparación interanual se habilitará al importar los periodos correspondientes.</p>';html+='<h3>Reservas del filtro ('+rows.length+')</h3><div style="max-height:360px;overflow:auto"><table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr><th>ID</th><th>Mes</th><th>Edificio</th><th>Canal</th><th>Noches</th><th>Producción</th><th>Descuento</th></tr></thead><tbody>'+rows.map(x=>`<tr><td>${escape(x.id)}</td><td>${escape(x.month)}</td><td>${escape(x.building)}</td><td>${escape(x.channel)}</td><td>${fmt(x.nights)}</td><td>${euro(x.gross)}</td><td>${euro(x.discount||0)}</td></tr>`).join('')+'</tbody></table></div>'; $('detail').innerHTML=html;$('detail').classList.remove('hidden');$('detail').scrollIntoView({behavior:'smooth',block:'nearest'})}

function setupFilters(data){
  const options=(id,key,label)=>{const values=[...new Set((window.PORTFOLIO_BOOKINGS?.length?window.PORTFOLIO_BOOKINGS:data.bookings).map(x=>x[key]))].sort();$(id).innerHTML='<option value="">'+label+'</option>'+values.map(x=>`<option value="${escape(x)}">${escape(x)}</option>`).join('')};
  const buildingValues=[...new Set((window.PORTFOLIO_BOOKINGS?.length?window.PORTFOLIO_BOOKINGS:data.bookings).map(x=>x.building))].sort();
  $('building').innerHTML=buildingValues.map(x=>`<option value="${escape(x)}">${escape(x)}</option>`).join('');
  window.SELECTED_BUILDINGS=new Set([...window.SELECTED_BUILDINGS].filter(b=>buildingValues.includes(b)));
  $('buildingOptions').innerHTML=buildingValues.map(x=>`<label class="multiselect-option"><input type="checkbox" class="building-opt" value="${escape(x)}" ${window.SELECTED_BUILDINGS.has(x)?'checked':''}> ${escape(x)}</label>`).join('');
  $('buildingOptAll').checked=!window.SELECTED_BUILDINGS.size;
  for(const opt of $('building').options)opt.selected=window.SELECTED_BUILDINGS.has(opt.value);
  updateBuildingTrigger();
  options('month','month','Mes más reciente');
}
$('buildingOptAll').addEventListener('change',()=>{
  if($('buildingOptAll').checked){window.SELECTED_BUILDINGS.clear();document.querySelectorAll('.building-opt').forEach(cb=>cb.checked=false)}
  updateBuildingTrigger();syncBuildingSelect();
});
$('buildingOptions').addEventListener('change',e=>{
  if(!e.target.classList.contains('building-opt'))return;
  if(e.target.checked)window.SELECTED_BUILDINGS.add(e.target.value);else window.SELECTED_BUILDINGS.delete(e.target.value);
  $('buildingOptAll').checked=!window.SELECTED_BUILDINGS.size;
  updateBuildingTrigger();syncBuildingSelect();
});
$('buildingTrigger').addEventListener('click',()=>$('buildingPanel').classList.toggle('hidden'));
document.addEventListener('click',e=>{if(!$('buildingSelect').contains(e.target))$('buildingPanel').classList.add('hidden')});
document.addEventListener('keydown',e=>{if(e.key==='Escape')$('buildingPanel')?.classList.add('hidden')});
