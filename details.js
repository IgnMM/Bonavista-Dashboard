/* Drilldowns used by every KPI. Uses the same filtered booking rows as the cards. */
function detailNumber(rows,key){
  const count=rows.length,sum=k=>rows.reduce((t,x)=>t+Number(x[k]||0),0);
  if(!count)return '—';
  if(key==='gross')return money(sum('gross'));
  if(key==='count')return num(count);
  if(key==='nights')return num(sum('nights'));
  if(key==='stay')return num(sum('nights')/count)+' noches';
  if(key==='guests'){const known=rows.filter(x=>x.guests!==null);return known.length?num(known.reduce((t,x)=>t+x.guests,0)/known.length):'—'}
  if(key==='lead')return num(sum('lead')/count)+' días';
  if(key==='direct'){const channels=new Set(model.direct.split(',').map(x=>x.trim().toLowerCase()));return sum('gross')?pct(rows.filter(x=>channels.has(x.channel.toLowerCase())).reduce((t,x)=>t+x.gross,0)/sum('gross')):'—'}
  if(['occupancy','adr','revpar'].includes(key)){
    const m=metrics();const result={occupancy:m.occupancy===null?'—':pct(m.occupancy),adr:m.adr===null?'—':money(m.adr),revpar:m.revpar===null?'—':money(m.revpar)};
    return result[key];
  }
  return '—';
}
let selectedDetailGroup=null;
function openDetail(key){
  selectedDetailGroup=null;
  const labels={gross:'Producción PVP',count:'Reservas',nights:'Noches reservadas',stay:'Estancia media',guests:'Ocupantes medios',lead:'Antelación de reserva',direct:'Venta directa',occupancy:'Ocupación',adr:'ADR',revpar:'RevPAR',cancel:'Cancelaciones',pickup:'Pickup'};
  const base=subset(), title=labels[key]||'Indicador';
  $('detail').innerHTML=`<div class="summary-top"><div><div class="mini">ANÁLISIS EN DETALLE</div><h2>${safe(title)} · ${detailNumber(base,key)}</h2></div><button class="ghost" id="closeDetail" type="button">Cerrar</button></div>
    <p class="note">${base.length} reservas confirmadas con los filtros actuales. Elige cómo desglosarlas; todas las cifras se recalculan al cambiar la dimensión.</p>
    <label class="detail-label">Desglosar por <select id="detailDimension"><option value="month">Mes de llegada</option><option value="building">Edificio</option><option value="channel">Canal</option><option value="rate">Tarifa</option><option value="roomType">Tipo de habitación</option><option value="country">País</option></select></label>
    <div id="detailYearComparison"></div><div id="detailBreakdown"></div><h3>Reservas incluidas</h3><div class="detail-scroll" id="detailRows"></div>`;
  $('detail').classList.remove('hidden');
  $('closeDetail').onclick=()=>$('detail').classList.add('hidden');
  $('detailDimension').value=base.length&&new Set(base.map(x=>x.month)).size>1?'month':'building';
  $('detailDimension').onchange=()=>{selectedDetailGroup=null;renderDetailBreakdown(key)};
  renderDetailBreakdown(key);
  window.BONAVISTA_COMPARISON?.renderDetail(key);
  $('detail').scrollIntoView({behavior:'smooth',block:'start'});
}
function renderDetailBreakdown(key){
  const rows=subset(),dimension=$('detailDimension').value;
  const groups={};for(const item of rows)(groups[item[dimension]]??=[]).push(item);
  const sorted=Object.entries(groups).sort((a,b)=>dimension==='month'?a[0].localeCompare(b[0]):b[1].reduce((s,x)=>s+x.gross,0)-a[1].reduce((s,x)=>s+x.gross,0));
  const total=rows.reduce((s,x)=>s+x.gross,0)||1;
  $('detailBreakdown').innerHTML=`<p class="note">Selecciona una fila para ver únicamente sus reservas; el desglose también agrupa la lista inferior.</p><table class="detail-table"><thead><tr><th>${safe(dimension)}</th><th>Valor del indicador</th><th>Reservas</th><th>Producción PVP</th><th>Mix ventas</th></tr></thead><tbody>${sorted.map(([label,group])=>{
    const p=group.reduce((s,x)=>s+x.gross,0);
    let shown=detailNumber(group,key);
    if(['occupancy','adr','revpar'].includes(key)){
      if(dimension==='month'||dimension==='building'){
        const m=metrics(dimension==='month'?label:undefined,dimension==='building'?label:undefined);
        shown=key==='occupancy'?(m.occupancy===null?'—':pct(m.occupancy)):key==='adr'?(m.adr===null?'—':money(m.adr)):(m.revpar===null?'—':money(m.revpar));
      }else shown='—';
    }
    return `<tr><td><button class="detail-group-button" data-group="${safe(label)}" type="button" aria-pressed="${selectedDetailGroup===label}">${safe(label)}</button></td><td>${safe(shown)}</td><td>${group.length}</td><td>${money(p)}</td><td>${pct(p/total)}</td></tr>`
  }).join('')}</tbody></table><p class="note">Ocupación, ADR y RevPAR se desglosan por mes o edificio; el valor por canal, tarifa o país se omite porque esos segmentos no tienen un inventario disponible propio.</p>`;
  $('detailRows').innerHTML=(selectedDetailGroup?`<p class="note">Filtro: ${safe(selectedDetailGroup)} · <button class="detail-clear" type="button">Ver todas las reservas</button></p>`:'')+sorted.filter(([label])=>!selectedDetailGroup||label===selectedDetailGroup).map(([label,group])=>`<h4>${safe(label)} · ${group.length} reservas · ${money(group.reduce((n,x)=>n+x.gross,0))}</h4><table class="detail-table"><thead><tr><th>ID</th><th>Llegada</th><th>Edificio</th><th>Canal</th><th>Noches</th><th>PVP</th><th>Descuento</th></tr></thead><tbody>${[...group].sort((a,b)=>String(a.arrival||a.month).localeCompare(String(b.arrival||b.month))).map(x=>`<tr><td>${safe(x.id)}</td><td>${safe(x.arrival||x.month)}</td><td>${safe(x.building)}</td><td>${safe(x.channel)}</td><td>${num(x.nights)}</td><td>${money(x.gross)}</td><td>${money(x.discount||0)}</td></tr>`).join('')}</tbody></table>`).join('');
  document.querySelectorAll('.detail-group-button').forEach(button=>button.addEventListener('click',()=>{selectedDetailGroup=selectedDetailGroup===button.dataset.group?null:button.dataset.group;renderDetailBreakdown(key)}));
  $('detailRows').querySelector('.detail-clear')?.addEventListener('click',()=>{selectedDetailGroup=null;renderDetailBreakdown(key)});
}
detail=openDetail;
modelDetail=openDetail;
