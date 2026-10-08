
let payload=null;const $=id=>document.getElementById(id);const euro=n=>new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(n);const fmt=n=>new Intl.NumberFormat('es-ES',{maximumFractionDigits:1}).format(n);const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
window.SELECTED_BUILDINGS=new Set();
/* Uso de Ignacio, no de Pablo: abrir con ?avanzado=1 en la URL para ver cargas anteriores e importar histórico. */
if(new URLSearchParams(location.search).has('avanzado'))document.getElementById('avanzadoWrap')?.classList.remove('hidden');
/* Elegir qué bloques entran al imprimir/PDF (p. ej. un informe de un edificio solo con ventas,
   sin mercado). El filtro de Edificio arriba ya recorta los datos; esto recorta qué secciones. */
function applyPrintBlockSelection(){
  document.querySelectorAll('.print-block-check').forEach(cb=>{
    const section=document.querySelector(`.print-block[data-print-block="${cb.dataset.printBlock}"]`);
    if(section)section.toggleAttribute('data-print-excluded',!cb.checked);
  });
}
function initPrintSelect(){
  const toggle=document.getElementById('printSelectToggle'),panel=document.getElementById('printSelectPanel');
  if(!toggle||!panel)return;
  toggle.addEventListener('click',()=>panel.classList.toggle('hidden'));
  document.addEventListener('click',e=>{if(!document.getElementById('printSelect').contains(e.target))panel.classList.add('hidden')});
  document.querySelectorAll('.print-block-check').forEach(cb=>cb.addEventListener('change',applyPrintBlockSelection));
  applyPrintBlockSelection();
}
initPrintSelect();
/* Confirmado por Pablo: directo es todo lo que no venga de Booking, Expedia, Airbnb u Oddo (agente). */
const NON_DIRECT_CHANNEL_MARKERS=['booking','expedia','airbnb','oddo'];
function isDirectChannel(name){return !NON_DIRECT_CHANNEL_MARKERS.some(p=>String(name||'').toLowerCase().includes(p))}
function matchBuilding(name,building){return !building||(building instanceof Set?building.has(name):name===building)}
function selectedBuilding(){return window.SELECTED_BUILDINGS.size?window.SELECTED_BUILDINGS:''}
function buildingLabel(building){if(!building)return'Todos los edificios';const names=[...building];return names.length===1?names[0]:names.length+' edificios seleccionados'}
function updateBuildingTrigger(){const t=$('buildingTrigger');if(t)t.textContent=buildingLabel(selectedBuilding())}
function syncBuildingSelect(){for(const opt of $('building').options)opt.selected=window.SELECTED_BUILDINGS.has(opt.value);$('building').dispatchEvent(new Event('change'))}
function buildingsEqual(a,b){const ka=a?[...a].sort().join(','):'',kb=b?[...b].sort().join(','):'';return ka===kb}
function openMonthFromChart(month){$('month').value=month;render()}
function resetToLatestMonth(){$('month').value='';render()}
function isViewingPastMonth(){const v=$('month').value;if(!v)return false;const now=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit'}).format(new Date());return v!==now}
async function exitSnapshotView(){window.VIEWING_SNAPSHOT=null;await refreshPortfolio();const items=await listSnapshots();if(items.length)payload=items[0].data;setupFilters(payload);render()}
function renderSnapshotBanner(){
 const holder=$('snapshotBanner');if(!holder)return;
 if(!window.VIEWING_SNAPSHOT){holder.classList.add('hidden');holder.innerHTML='';return}
 holder.classList.remove('hidden');
 holder.innerHTML='Viendo la carga guardada del '+new Date(window.VIEWING_SNAPSHOT).toLocaleString('es-ES')+': así se veía la cartera en ese momento, no necesariamente cómo se ve ahora. <button type="button" class="ghost" id="exitSnapshot">Volver a la vista actual</button>';
 $('exitSnapshot').onclick=()=>exitSnapshotView();
}

$('load').onclick=async()=>{const a=$('bookings').files[0],b=$('services').files[0];if(!a||!b){$('status').textContent='Selecciona los dos archivos de la misma exportación.';return} window.VIEWING_SNAPSHOT=null;$('status').textContent='Validando los archivos…';const wasVisible=!$('dashboard').classList.contains('hidden');$('dashboard').classList.add('hidden');try{const data=await analyseFiles(a,b);payload=data;let saved=true;let isNew=true;try{isNew=await saveSnapshot(data,a.name,b.name)}catch(err){saved=false}setupFilters(data);$('dashboard').classList.remove('hidden');await saveVersionToFolderIfConnected();if(window.updateFolderPrompt)updateFolderPrompt();$('status').textContent=(saved?(isNew?'Nueva captura guardada: ':'Captura idéntica a otra ya guardada; sin duplicar: '):'Importación mostrada sin guardar; el navegador bloqueó el almacenamiento local: ')+data.meta.reservations+' reservas y '+data.meta.service_lines+' líneas de servicios.';render()}catch(e){if(wasVisible)$('dashboard').classList.remove('hidden');const zipError=/central directory|zip file|Falta la columna|XML no válido|libro XLSX/i.test(e.message);$('status').textContent=zipError?'No se ha podido leer el Excel de reservas ('+e.message.slice(0,90)+'). Comprueba que has elegido el Excel de reservas BOOKIPRO (.xlsx) y el CSV de desglose de servicios, no al revés. No se ha cambiado nada.':'Error: '+e.message+(wasVisible?' No se ha cambiado nada: sigues viendo los datos anteriores.':'')}};
$('building').onchange=()=>render();$('month').onchange=()=>render();
$('openSnapshot').onclick=async()=>{const id=$('snapshots').value;if(!id)return;const record=(await listSnapshots()).find(x=>x.id===id);if(!record)return;payload=record.data;window.PORTFOLIO_BOOKINGS=record.data.bookings;window.PORTFOLIO_CANCELLED=record.data.meta.cancelled||[];window.PORTFOLIO_CANCELLED_KNOWN=new Set(Array.isArray(record.data.meta.cancelled)?[...new Set(record.data.bookings.map(x=>x.month)),...record.data.meta.cancelled.map(r=>r.month)]:[]);window.PORTFOLIO_ASOF=Object.fromEntries([...new Set(record.data.bookings.map(x=>x.month))].map(month=>[month,record.data.meta.as_of||id.slice(0,10)]));window.VIEWING_SNAPSHOT=id;setupFilters(payload);$('dashboard').classList.remove('hidden');$('status').textContent='Carga del '+new Date(id).toLocaleString('es-ES')+' · '+record.bookName;render()};
$('backup').onclick=()=>exportSnapshots().catch(e=>$('status').textContent=e.message);
$('chooseRestoreFile').onclick=()=>$('restoreBackup').click();
$('restoreBackup').addEventListener('change',event=>{const file=event.target.files[0];if(file)runRestore(file)});
async function runRestore(file){
  const st=$('restoreStatus');st.classList.remove('error');st.textContent='';
  const done=()=>{$('restoreBackup').value=''};
  let preview;try{preview=JSON.parse(await file.text())}catch(e){st.textContent='El archivo no es un JSON válido';st.classList.add('error');done();return}
  const whenText=preview.exportedAt?new Date(preview.exportedAt).toLocaleString('es-ES'):'fecha desconocida';
  const safety=window.BONAVISTA_FOLDER?'Antes se guardará una copia del estado actual en tu carpeta, por si hace falta deshacerlo.':'Antes se descargará una copia del estado actual, por si hace falta deshacerlo.';
  if(!confirm('¿Abrir la copia de dashboard del '+whenText+'? Se añade a los datos actuales sin borrarlos. '+safety)){done();return}
  st.textContent='Guardando copia del estado actual…';
  try{
    if(window.BONAVISTA_FOLDER)await saveVersionToFolderIfConnected();else{try{await exportSnapshots()}catch(e){if(!/Todavía no hay datos/.test(e.message))throw e}}
    st.textContent='Leyendo el archivo…';
    const result=await restoreSnapshots(file);const historicoNote=(result.historicoAdded||result.historicoUpdated)?` Histórico: ${result.historicoAdded} filas nuevas, ${result.historicoUpdated} actualizadas.`:'';
    const msg=`Copia del ${whenText} incorporada: ${result.added} cargas y ${result.marketAdded} observaciones de mercado nuevas.${historicoNote} Los datos previos se conservan.`;
    $('status').textContent=msg;st.textContent='✓ '+msg;done();
    await saveVersionToFolderIfConnected();
    if(window.updateFolderPrompt)await updateFolderPrompt();
    if(payload){setupFilters(payload);render()}else{location.reload()}
  }catch(e){const msg='No se pudo abrir la copia: '+e.message;$('status').textContent=msg;st.textContent=msg;st.classList.add('error');done()}
}
function renderFolderStatus(text,isError){const el=$('folderStatus');if(!el)return;el.textContent=text||'';el.classList.toggle('error',!!isError)}
/* Deliberadamente NO carga sola al abrir la página: hacerlo automático pisaba restauraciones
   manuales recién hechas si la carpeta tenía una versión distinta (p. ej. una copia vacía guardada
   sin querer). Guardar sigue siendo automático; traer datos de la carpeta requiere este botón. */
async function doLoadFromFolder(){
  renderFolderStatus('Cargando lo último guardado en la carpeta…');
  try{
    const loaded=await loadLatestFromFolderIfConnected();
    renderFolderStatus(loaded?'✓ Cargado lo último guardado en la carpeta: '+loaded.added+' captura(s) y '+loaded.marketAdded+' observación(es) de mercado nuevas.':'La carpeta todavía no tiene ninguna versión guardada.');
    if(payload){setupFilters(payload);render()}else{location.reload()}
  }catch(e){renderFolderStatus('No se pudo cargar desde la carpeta: '+e.message,true)}
}
async function doConnectFolder(){
  try{await connectFolder();await saveVersionToFolderIfConnected();renderFolderStatus('✓ Carpeta conectada: a partir de ahora cada cambio se guarda aquí solo.')}
  catch(e){if(e.name!=='AbortError')renderFolderStatus('No se pudo conectar la carpeta: '+e.message,true)}
  await updateFolderPrompt();
}
async function doReconnectFolder(){
  const {handle}=await reconnectFolder();
  if(!handle){renderFolderStatus('Todavía no has elegido carpeta en este ordenador.',true);return}
  let ok=false;try{ok=await requestFolderPermission(handle)}catch(e){}
  if(!ok){renderFolderStatus('No se ha podido activar. Inténtalo de nuevo.',true);return}
  renderFolderStatus('✓ Guardando aquí automáticamente de nuevo.');
  await updateFolderPrompt();
}
/* Banner visible fuera del desplegable: pide elegir carpeta (único paso manual que exige el navegador),
   reactivar el permiso, o recuperar los datos de la carpeta si este navegador está vacío. */
async function updateFolderPrompt(){
  if(!supportsFolderAccess()||!$('folderPrompt'))return;
  const s=await reconnectFolder();let items=[];try{items=await listSnapshots()}catch(e){}
  let mode=null,versions=0;
  if(s.connected){try{versions=(await listSavedVersions(s.handle)).length}catch(e){}if(!items.length&&versions)mode='recover'}
  else mode=s.needsPermission?'reconnect':'connect';
  const texts={connect:['Tus datos solo se guardan en este navegador. Elige una carpeta y cada cambio se guardará solo como copia de seguridad.','Elegir carpeta…'],reconnect:['El guardado automático necesita que confirmes el permiso de la carpeta (el navegador lo pide de vez en cuando).','Reactivar guardado automático'],recover:['No hay datos en este navegador, pero tu carpeta tiene copias guardadas.','Recuperar mis datos']};
  const box=$('folderPrompt');box.dataset.mode=mode||'';box.classList.toggle('hidden',!mode);
  if(mode){$('folderPromptText').textContent=texts[mode][0];$('folderPromptBtn').textContent=texts[mode][1]}
  $('connectFolder').classList.toggle('hidden',!!s.connected||!!s.needsPermission);
  $('backup').classList.toggle('hidden',!!s.connected);$('lastBackup').classList.toggle('hidden',!!s.connected);
  $('reconnectFolder').classList.toggle('hidden',!s.needsPermission);
  $('recoverNote').classList.toggle('hidden',!(s.connected&&versions));
  if(s.connected)renderFolderStatus('✓ Guardado automático activo'+(s.handle.name?' en la carpeta «'+s.handle.name+'»':'')+'.');
  else if(s.needsPermission)renderFolderStatus('Carpeta elegida; falta confirmar el permiso del navegador.');
  else renderFolderStatus('Todavía no hay carpeta elegida: los datos solo están en este navegador.');
}
window.updateFolderPrompt=updateFolderPrompt;
async function initFolderUi(){
  if(!$('folderBlock'))return;
  if(!supportsFolderAccess())return; // Firefox/Safari: no mostrar esta opción.
  $('folderBlock').classList.remove('hidden');
  $('connectFolder').onclick=doConnectFolder;
  $('reconnectFolder').onclick=doReconnectFolder;
  $('loadFromFolder').onclick=()=>doLoadFromFolder();
  $('folderPromptBtn').onclick=async()=>{const m=$('folderPrompt').dataset.mode;if(m==='connect')await doConnectFolder();else if(m==='reconnect')await doReconnectFolder();else if(m==='recover')await doLoadFromFolder()};
  await updateFolderPrompt();
}
refreshSnapshots().catch(e=>$('status').textContent='No se puede acceder al almacenamiento local: '+e.message);
renderLastBackup();
/* Diferido a DOMContentLoaded: baseline.js (initHistorical) se carga después de este archivo en
   el HTML, así que llamarlo aquí mismo fallaría; para entonces ya está disponible. */
window.addEventListener('DOMContentLoaded',()=>{(async()=>{try{if(typeof initHistorical==='function')await initHistorical()}catch(e){}try{await initFolderUi()}catch(e){}try{const items=await listSnapshots();if(!items.length)return;await refreshPortfolio();if(!window.PORTFOLIO_BOOKINGS.length)return;payload=items[0].data;setupFilters(payload);$('dashboard').classList.remove('hidden');$('status').textContent='Cargado automáticamente con lo guardado en este navegador ('+items.length+' capturas). Sube un archivo solo para añadir un mes nuevo o actualizar el mes en curso.';render()}catch(e){}})()});
function subset(){const p=window.periodMonths?window.periodMonths():null,months=p?new Set(p.months):null,building=selectedBuilding();return (window.PORTFOLIO_BOOKINGS?.length?window.PORTFOLIO_BOOKINGS:payload.bookings).filter(x=>(!building||matchBuilding(x.building,building))&&(!months||months.has(x.month)))}
function distribution(rows,key,element,measure='gross',limit=10,pctOnly=false){const sums={};for(const r of rows)sums[r[key]]=(sums[r[key]]||0)+(measure==='count'?1:r[measure]);const entries=Object.entries(sums).sort((a,b)=>b[1]-a[1]).slice(0,limit),max=entries[0]?.[1]||1,total=rows.reduce((s,r)=>s+(measure==='count'?1:r[measure]),0)||1;const showPct=pctOnly||(window.SALES_VIEW_MODE||'eur')==='pct';$(element).innerHTML=entries.length?entries.map(([name,n])=>`<div class="barrow"><span title="${escape(name)}">${escape(name.length>22?name.slice(0,20)+'…':name)}</span><div class="track"><div class="fill" style="width:${Math.max(1,100*n/max)}%"></div></div><span class="right">${showPct?fmt(n/total*100)+' %':euro(n)}</span></div>`).join(''):'<p class="note">Sin datos para el filtro seleccionado.</p>'}
function renderSalesExtras(rows){
 const gross=rows.reduce((a,b)=>a+b.gross,0),n=rows.length;
 $('salesViewBase').textContent='Base: '+euro(gross)+' en '+fmt(n)+' reservas del periodo elegido.';
 const directGross=rows.filter(x=>isDirectChannel(x.channel)).reduce((a,b)=>a+b.gross,0);
 $('directNote').textContent=gross?'Venta directa: '+fmt(directGross/gross*100)+' % del canal.':'';
 const cancelKnown=(window.PORTFOLIO_CANCELLED_KNOWN?.size||0)>0;
 $('ritmoNote').textContent=cancelKnown?'':'Cancelaciones: sin datos todavía; se leerán al cargar un archivo de BOOKIPRO que incluya reservas canceladas.';
}
function renderServiceBreakdown(rows){
 const holder=$('serviceBreakdown');if(!holder)return;
 const rentalTotal=rows.reduce((s,r)=>s+(r.rental||0),0);
 const conceptTotals={},buildingConcepts={};
 for(const r of rows){
  for(const [concept,amount] of Object.entries(r.serviceItems||{})){
   if(!amount)continue;
   conceptTotals[concept]=(conceptTotals[concept]||0)+amount;
   (buildingConcepts[r.building]??={})[concept]=(buildingConcepts[r.building]?.[concept]||0)+amount;
  }
 }
 const entries=Object.entries(conceptTotals).sort((a,b)=>b[1]-a[1]);
 if(!entries.length){holder.innerHTML='<p class="note">Sin conceptos de servicios (limpieza, parking u otros) en el filtro actual.</p>';return}
 const bars=[['Alquiler (base, sin estos conceptos)',rentalTotal],...entries],max=Math.max(1,...bars.map(([,v])=>v));
 const buildings=Object.keys(buildingConcepts).sort(),concepts=entries.map(([name])=>name);
 const table=buildings.length>1?`<table class="detail-table"><thead><tr><th>Edificio</th>${concepts.map(c=>`<th>${escape(c)}</th>`).join('')}</tr></thead><tbody>${buildings.map(b=>`<tr><td>${escape(b)}</td>${concepts.map(c=>`<td>${buildingConcepts[b][c]?euro(buildingConcepts[b][c]):'—'}</td>`).join('')}</tr>`).join('')}</tbody></table>`:'';
 holder.innerHTML=`<div class="section-bars">${bars.map(([name,v])=>`<div class="barrow"><span title="${escape(name)}">${escape(name)}</span><div class="track"><div class="fill" style="width:${Math.max(1,100*v/max)}%"></div></div><span class="right">${euro(v)}</span></div>`).join('')}</div>${table}<p class="note">Desglose de los conceptos del CSV de servicios sobre las reservas del filtro actual (edificio y periodo elegidos arriba). No todos los edificios tienen los mismos conceptos. Categorías provisionales: se revisan con Pablo.</p>`;
}
function renderDashboardStatusLine(){
  const holder=$('dashboardStatusLine');if(!holder)return;
  const lastLoad=Object.values(window.PORTFOLIO_ASOF||{}).concat(payload?.meta?.as_of?[payload.meta.as_of]:[]).sort().at(-1);
  const histRows=(typeof historical!=='undefined'&&historical?.rows)||[];
  const histMonths=histRows.length?[...new Set(histRows.map(r=>r.month))].sort():[];
  const parts=[];
  if(lastLoad)parts.push('Última actualización: '+new Date(lastLoad).toLocaleDateString('es-ES'));
  parts.push(histMonths.length?'Histórico disponible: '+histMonths[0]+' a '+histMonths.at(-1):'Histórico: no cargado todavía');
  holder.textContent=parts.join(' · ');
}
function render(){renderDashboardStatusLine();const rows=subset(),n=rows.length,nights=rows.reduce((a,b)=>a+b.nights,0);$('coverage').textContent=n+' reservas · '+(nights?fmt(nights)+' noches':'sin noches');$('printMeta').textContent='Periodo: '+($('month').value||'mes más reciente')+' · Edificio: '+buildingLabel(selectedBuilding())+' · Reservas: '+n+' · Elaborado: '+new Date().toLocaleDateString('es-ES');distribution(rows,'channel','channels');distribution(rows,'building','buildings');distribution(rows,'country','countries','count',10,true);distribution(rows,'rate','rates');distribution(rows,'roomType','roomtypes');renderSalesExtras(rows);renderServiceBreakdown(rows);$('quality').textContent=`Datos de origen: ${payload.meta.channel_coverage}/${payload.meta.reservations} reservas con canal; ${payload.meta.excluded_reservations||0} reservas no confirmadas excluidas; ${payload.meta.date_warnings} diferencias entre fechas y noches; ${payload.meta.reconciliation_warnings} reservas cuyo total PVP no coincide con los conceptos del CSV menos el descuento registrado. Consultar a Pablo cualquier diferencia restante. La producción está agrupada provisionalmente por mes de llegada.`;$('detailOverlay').classList.add('hidden')}
$('salesViewMode')?.addEventListener('change',()=>{window.SALES_VIEW_MODE=$('salesViewMode').value;render()});
$('detailClose')?.addEventListener('click',()=>$('detailOverlay').classList.add('hidden'));
$('detailOverlay')?.addEventListener('click',e=>{if(e.target.id==='detailOverlay')$('detailOverlay').classList.add('hidden')});
document.addEventListener('keydown',e=>{if(e.key==='Escape')$('detailOverlay')?.classList.add('hidden')});

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
