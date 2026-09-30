/* Market observations: no reservation data leaves the browser. */
(function(){
'use strict';
const KEY='bonavista-market-v1', REVIEW_KEY='bonavista-reviews-v1';
const $m=id=>document.getElementById(id);
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function read(){try{return JSON.parse(localStorage.getItem(KEY)||'{"reviews":[],"rates":[]}')}catch{return {reviews:[],rates:[]}}}
function validateDate(value){if(typeof value!=='string'||!/^\d{4}-\d\d-\d\d(?:T.*)?$/.test(value)||!Number.isFinite(Date.parse(value)))throw Error('Fecha inválida: '+value);return value}
function validate(body){if(!body||body.format!=='bonavista-market-v1'||!Array.isArray(body.reviews)||!Array.isArray(body.rates))throw Error('Formato de integración inválido');if(body.reviews.length>5000||body.rates.length>10000)throw Error('Demasiados registros');return body}
function ingest(body){validate(body);const db=read(),reviews=JSON.parse(localStorage.getItem(REVIEW_KEY)||'{}');let addedReviews=0,addedRates=0;
 for(const r of body.reviews){if(!['Booking','Expedia','Airbnb','Google'].includes(r.platform)||typeof r.building!=='string'||!r.building.trim()||!Number.isFinite(r.score)||r.score<0||r.score>(['Booking','Expedia'].includes(r.platform)?10:5))throw Error('Valoración inválida');if(r.reviewCount!==undefined&&(!Number.isInteger(r.reviewCount)||r.reviewCount<0))throw Error('Número de opiniones inválido');validateDate(r.capturedAt);if(typeof r.source!=='string'||!/^https:\/\//.test(r.source))throw Error('Fuente de valoración inválida');const id=[r.platform,r.building,r.source].join('|');const series=db.reviews.filter(x=>[x.platform,x.building,x.source].join('|')===id).sort((a,b)=>a.capturedAt.localeCompare(b.capturedAt));const last=series.at(-1);const categories=r.categories&&typeof r.categories==='object'?r.categories:{};if(last&&last.score===r.score&&(last.reviewCount||null)===(r.reviewCount||null)&&JSON.stringify(last.categories||{})===JSON.stringify(categories))continue;const record={platform:r.platform,building:r.building,capturedAt:r.capturedAt,score:r.score,categories,source:r.source};if(r.reviewCount)record.reviewCount=r.reviewCount;db.reviews.push(record);const bucketKey=r.building+'|'+r.platform;(reviews[bucketKey]??=[]).push({date:r.capturedAt,score:r.score,categories,source:r.source,reviewCount:r.reviewCount||undefined});addedReviews++}
 for(const r of body.rates){if(typeof r.property!=='string'||!r.property.trim()||typeof r.building!=='string'||!r.building.trim()||typeof r.source!=='string'||!/^https:\/\//.test(r.source)||!Number.isFinite(r.total)||r.total<0||!Number.isInteger(r.guests)||r.guests<1||!Number.isInteger(r.nights)||r.nights<1||r.nights>60||typeof r.currency!=='string'||!/^[A-Z]{3}$/.test(r.currency))throw Error('Tarifa inválida');if(r.platform!==undefined&&!['Airbnb','Booking','Expedia','Otro'].includes(r.platform))throw Error('Plataforma de tarifa inválida');validateDate(r.capturedAt);validateDate(r.checkin);const key=x=>[x.property,x.building,x.source,x.checkin,x.nights,x.guests,x.currency,x.total,x.plan||''].join('|');if(db.rates.some(x=>key(x)===key(r)))continue;db.rates.push({property:r.property,building:r.building,source:r.source,capturedAt:r.capturedAt,checkin:r.checkin,nights:r.nights,guests:r.guests,currency:r.currency,total:r.total,plan:r.plan||'',platform:r.platform||''});addedRates++}
 localStorage.setItem(KEY,JSON.stringify(db));localStorage.setItem(REVIEW_KEY,JSON.stringify(reviews));if($m('dashboard')&&!$m('dashboard').classList.contains('hidden')){if(typeof showReviews==='function')showReviews();if(typeof showCompetitorReviews==='function')showCompetitorReviews()}renderMarket();return {addedReviews,addedRates}}
const COMP_KEY='bonavista-price-competitors-v1';
// Sugerencias de partida (2026-09-30), no confirmadas: aparthoteles/apartamentos con servicio
// reales en Barcelona que podrían ser competencia de Bonavista. A validar con Pablo — son un
// punto de partida para rellenar, no una lista definitiva.
const SEED_COMPETITOR_SUGGESTIONS=[
 {name:'Eric Vökel Boutique Apartments',city:'Barcelona'},
 {name:'AB Apartment Barcelona',city:'Barcelona'},
 {name:'MH Apartments Barcelona',city:'Barcelona'},
 {name:'Aspasios Boutique Apartments',city:'Barcelona'}
];
function readCompetitors(){try{return JSON.parse(localStorage.getItem(COMP_KEY)||'[]')}catch{return []}}
function saveCompetitors(list){localStorage.setItem(COMP_KEY,JSON.stringify(list))}
function knownCompetitorNames(db,active){
 // Reused for the "competidor existente" dropdown: names already tracked, ever priced (even if
 // later quitado — el historico de precios no se borra), or suggested — never Bonavista's own.
 const fromRates=db.rates.filter(x=>!/^Bonavista/i.test(x.property)).map(x=>({name:x.property,city:''}));
 const all=[...active.map(c=>({name:c.name,city:c.city})),...fromRates,...SEED_COMPETITOR_SUGGESTIONS];
 const byName=new Map();for(const c of all)if(!byName.has(c.name))byName.set(c.name,c);
 return [...byName.values()].sort((a,b)=>a.name.localeCompare(b.name));
}
function addDays(dateIso,days){const d=new Date(dateIso+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10)}
function competitorDates(c){const today=new Date().toISOString().slice(0,10);const checkin=addDays(today,c.leadDays);const checkout=addDays(checkin,c.nights);return {checkin,checkout}}
// Deep links into each platform's own search — never fetched or read by the app itself, Pablo
// opens them, finds the listing himself and judges whether it is really comparable before typing
// the price in. No automated reading of competitor prices from any of these three.
const PLATFORM_SEARCH={
 Airbnb:c=>{const {checkin,checkout}=competitorDates(c);return `https://www.airbnb.com/s/${encodeURIComponent(c.city)}/homes?query=${encodeURIComponent(c.name)}&checkin=${checkin}&checkout=${checkout}&adults=${c.guests}`},
 Booking:c=>{const {checkin,checkout}=competitorDates(c);return `https://www.booking.com/searchresults.es.html?ss=${encodeURIComponent(c.name+' '+c.city)}&checkin=${checkin}&checkout=${checkout}&group_adults=${c.guests}&no_rooms=1&group_children=0`},
 Expedia:c=>{const {checkin,checkout}=competitorDates(c);return `https://www.expedia.es/Hotel-Search?destination=${encodeURIComponent(c.name+' '+c.city)}&startDate=${checkin}&endDate=${checkout}&adults=${c.guests}`}
};
function renderPriceCompetitors(){
 const holder=$m('priceCompetitors');if(!holder)return;
 const list=readCompetitors(),db=read();
 const buildingNames=[...new Set((window.PORTFOLIO_BOOKINGS?.length?window.PORTFOLIO_BOOKINGS:(typeof payload!=='undefined'&&payload?.bookings||[])).map(x=>x.building))].sort();
const suggestions=knownCompetitorNames(db,list).filter(s=>!list.some(c=>c.name===s.name));
 holder.innerHTML=`
  <div class="history-row">${suggestions.length?`<label>Competidor existente <select id="compExisting"><option value="">Elegir de la lista…</option>${suggestions.map(s=>`<option value="${escape(s.name)}" data-city="${escape(s.city)}">${escape(s.name)}</option>`).join('')}</select></label>`:''}</div>
  <div class="history-row"><input id="compName" placeholder="Nombre del alojamiento competidor"><input id="compCity" placeholder="Ciudad" value="Barcelona"><select id="compBuilding"><option value="">Edificio Bonavista de referencia</option>${buildingNames.map(b=>`<option value="${escape(b)}">${escape(b)}</option>`).join('')}</select></div>
  <div class="history-row"><label>Noches <input id="compNights" type="number" min="1" max="30" value="2" style="width:60px"></label><label>Antelación (días) <input id="compLead" type="number" min="0" max="365" value="14" style="width:70px"></label><label>Personas <input id="compGuests" type="number" min="1" max="10" value="2" style="width:60px"></label><button class="ghost" id="compAdd" type="button">Añadir competidor</button></div>
  <p class="note">Criterio confirmado con Pablo: mismo barrio, categoría de apartamento similar, tarifa flexible/cancelable, precio final con impuestos incluidos. Cada botón abre la búsqueda de esa plataforma para las mismas fechas; comprueba que la ficha encontrada es realmente comparable antes de guardar el precio.</p>
  ${list.length?list.map(c=>{
    const {checkin,checkout}=competitorDates(c);
    const historyRows=db.rates.filter(x=>x.property===c.name&&x.building===c.building).sort((a,b)=>b.capturedAt.localeCompare(a.capturedAt));
    const last=historyRows[0];
    return `<div class="panel" data-comp="${c.id}">
     <div class="history-row"><b>${escape(c.name)}</b><small>${escape(c.city)} · ${escape(c.building)} · ${checkin} → ${checkout} · ${c.nights} noches, ${c.guests} personas</small><button class="ghost" data-comp-delete="${c.id}" type="button">Quitar</button></div>
     ${Object.keys(PLATFORM_SEARCH).map(platform=>`<div class="history-row"><a href="${escape(PLATFORM_SEARCH[platform](c))}" target="_blank" rel="noopener noreferrer" class="ghost platform-link platform-${platform.toLowerCase()}">Ver en ${platform}</a><input type="number" min="0" step="1" placeholder="Precio en ${platform} (€)" data-comp-price="${c.id}|${platform}" style="width:160px"><button class="ghost" data-comp-save="${c.id}|${platform}" type="button">Guardar</button></div>`).join('')}
     ${last?`<p class="note">Último guardado: ${escape(last.platform||'plataforma sin indicar')} · ${new Intl.NumberFormat('es-ES',{style:'currency',currency:last.currency}).format(last.total)} · estancia ${escape(last.checkin)} · capturado ${escape(last.capturedAt.slice(0,10))}</p>`:'<p class="note">Sin precios guardados todavía para este competidor.</p>'}
     ${historyRows.length?`<details><summary>Ver ${historyRows.length} consulta${historyRows.length===1?'':'s'} anterior${historyRows.length===1?'':'es'}</summary><table class="detail-table"><thead><tr><th>Plataforma</th><th>Fecha estancia</th><th>Precio</th><th>Capturado</th><th>Fuente</th></tr></thead><tbody>${historyRows.map(h=>`<tr><td>${escape(h.platform||'—')}</td><td>${escape(h.checkin)}</td><td>${new Intl.NumberFormat('es-ES',{style:'currency',currency:h.currency}).format(h.total)}</td><td>${escape(h.capturedAt.slice(0,10))}</td><td><a href="${escape(h.source)}" target="_blank" rel="noopener noreferrer">Abrir</a></td></tr>`).join('')}</tbody></table></details>`:''}
    </div>`;
  }).join(''):'<p class="note">Sin competidores definidos todavía. Añade uno arriba: nombre, ciudad y a qué edificio de Bonavista se compara.</p>'}
 `;
 $m('compExisting')?.addEventListener('change',()=>{
  const sel=$m('compExisting'),opt=sel.selectedOptions[0];if(!sel.value)return;
  $m('compName').value=sel.value;$m('compCity').value=opt.dataset.city||$m('compCity').value||'Barcelona';
 });
 $m('compAdd')?.addEventListener('click',()=>{
  const name=$m('compName').value.trim(),city=$m('compCity').value.trim(),building=$m('compBuilding').value,nights=Number($m('compNights').value)||2,leadDays=Number($m('compLead').value)||0,guests=Number($m('compGuests').value)||2;
  if(!name||!city||!building){alert('Completa nombre, ciudad y edificio de referencia');return}
  const updated=readCompetitors();updated.push({id:Date.now()+'-'+Math.random().toString(36).slice(2,7),name,city,building,nights,leadDays,guests});saveCompetitors(updated);renderPriceCompetitors();
 });
 holder.querySelectorAll('[data-comp-delete]').forEach(btn=>btn.addEventListener('click',()=>{
  if(!confirm('¿Quitar este competidor de la lista activa? Sus precios ya guardados se conservan en el histórico y la copia de seguridad, y podrás volver a añadirlo desde el desplegable «Competidor existente».'))return;
  saveCompetitors(readCompetitors().filter(c=>c.id!==btn.dataset.compDelete));renderPriceCompetitors();
 }));
 holder.querySelectorAll('[data-comp-save]').forEach(btn=>btn.addEventListener('click',()=>{
  const [id,platform]=btn.dataset.compSave.split('|'),c=list.find(x=>x.id===id);if(!c)return;
  const priceInput=holder.querySelector(`[data-comp-price="${id}|${platform}"]`),total=Number(priceInput.value);
  if(!Number.isFinite(total)||total<=0){alert('Introduce un precio válido');return}
  const {checkin}=competitorDates(c);
  try{ingest({format:'bonavista-market-v1',reviews:[],rates:[{property:c.name,building:c.building,platform,source:PLATFORM_SEARCH[platform](c),capturedAt:new Date().toISOString(),checkin,nights:c.nights,guests:c.guests,currency:'EUR',total,plan:'flexible/cancelable'}]});priceInput.value='';renderPriceCompetitors()}catch(e){alert('No se pudo guardar: '+e.message)}
 }));
}
function renderMarket(){const db=read(),building=selectedBuilding(),competitorRates=db.rates.filter(x=>!/^Bonavista/i.test(x.property)),filtered=competitorRates.filter(x=>!building||matchBuilding(x.building,building)),latest=[...filtered].sort((a,b)=>b.capturedAt.localeCompare(a.capturedAt)).slice(0,12);$m('marketTable').innerHTML=latest.length?'<div class="market-scroll"><table class="detail-table"><thead><tr><th>Alojamiento</th><th>Plataforma</th><th>Fecha estancia</th><th>Noches / personas</th><th>Precio total</th><th>Capturado</th><th>Fuente</th></tr></thead><tbody>'+latest.map(x=>`<tr><td>${escape(x.property)}<small> · ${escape(x.building)}</small></td><td>${escape(x.platform||'—')}</td><td>${escape(x.checkin.slice(0,10))}</td><td>${x.nights} / ${x.guests}</td><td>${new Intl.NumberFormat('es-ES',{style:'currency',currency:x.currency}).format(x.total)}</td><td>${escape(x.capturedAt.slice(0,10))}</td><td><a href="${escape(x.source)}" target="_blank" rel="noopener noreferrer">Abrir</a></td></tr>`).join('')+'</tbody></table></div>':'<p class="note">No hay precios de competidores guardados para este edificio. Se añaden más abajo.</p>';$m('marketCount').textContent=competitorRates.length+' precios de competidores guardados';}
async function refresh(){const button=$m('marketRefresh'),endpoint=window.BONAVISTA_MARKET_ENDPOINT;if(!endpoint){$m('marketStatus').textContent='La actualización automática se activará cuando esté conectado el servicio de mercado.';return}button.disabled=true;$m('marketStatus').textContent='Consultando mercado…';try{const response=await fetch(endpoint,{method:'POST',headers:{'Accept':'application/json'},credentials:'same-origin',cache:'no-store'});if(!response.ok)throw Error('El servicio de mercado devolvió HTTP '+response.status);const content=await response.json(),result=ingest(content);$m('marketStatus').textContent=`Actualizado: ${result.addedReviews} cambios de nota y ${result.addedRates} precios nuevos. ${content.errors?.length||0} fichas no disponibles${content.errors?.length?': '+content.errors.map(x=>x.platform+' / '+x.building+' ('+x.error+')').join('; '):''}. Los valores repetidos no se guardan.`}catch(error){$m('marketStatus').textContent=error instanceof TypeError?'El servicio de mercado no responde. Inténtalo más tarde.':error.message}finally{button.disabled=false}}
$m('marketRefresh').addEventListener('click',refresh);$m('marketFile').addEventListener('change',async event=>{const file=event.target.files[0];if(!file)return;try{const result=ingest(JSON.parse(await file.text()));$m('marketStatus').textContent=`Importación: ${result.addedReviews} cambios de nota y ${result.addedRates} precios nuevos.`}catch(error){$m('marketStatus').textContent=error.message}event.target.value=''});$m('building').addEventListener('change',()=>{renderMarket();renderPriceCompetitors()});renderMarket();renderPriceCompetitors();if(!window.BONAVISTA_MARKET_ENDPOINT){$m('marketRefresh').disabled=true;$m('marketRefresh').title='Servicio de mercado pendiente de activación'}window.BONAVISTA_MARKET={ingest,read};
if(typeof render==='function'){const previousRender=render;render=function(){previousRender();renderPriceCompetitors()}}
})();
