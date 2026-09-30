/* Historical comparison is optional and local. Do not put source exports in a public repository. */
const BASELINE_KEY='bonavista-baseline-v1';
let historical=window.BONAVISTA_BASELINE||JSON.parse(localStorage.getItem(BASELINE_KEY)||'null');
function renderSimulatedBanner(){
  const holder=document.getElementById('simulatedBanner');if(!holder)return;
  const historicalMonths=[...new Set((historical?.rows||[]).filter(x=>x.simulated).map(x=>x.month))];
  const bookingMonths=[...new Set((typeof latest==='function'?latest():[]).filter(x=>x.simulated).map(x=>x.month))];
  const allMonths=[...new Set([...historicalMonths,...bookingMonths])].sort();
  if(!allMonths.length){holder.innerHTML='';return}
  const parts=[];
  if(historicalMonths.length)parts.push('el histórico agregado (Tamarit 2024-2025 y enero-agosto 2026 en todos los edificios)');
  if(bookingMonths.length){const sorted=bookingMonths.sort();parts.push(sorted.length>1?`las reservas cargadas de ${sorted[0]} a ${sorted.at(-1)}`:`las reservas cargadas de ${sorted[0]}`)}
  holder.innerHTML=`<b>⚠ Datos inventados en esta pantalla</b><span>${parts.join(' y ')} son una simulación de prueba, no cifras reales de Bonavista. Hay que pedir a Pablo las exportaciones reales de esos periodos antes de usar estas cifras para nada. Esta carga de prueba es solo local en este navegador; nunca se sube a GitHub.</span>`;
}
function initBaseline(){}
/* Merges by mes+edificio: filas nuevas se añaden, filas repetidas se actualizan con la versión
   entrante (más reciente/reconstruida), y cualquier fila existente que no venga en el archivo
   nuevo se conserva tal cual. Importar un archivo parcial o antiguo nunca borra histórico previo. */
function mergeHistorico(existing,incoming){
  const byKey=new Map();
  for(const row of (existing?.rows||[]))byKey.set(row.month+'|'+row.building,row);
  let added=0,updated=0;
  for(const row of incoming.rows){const key=row.month+'|'+row.building;if(byKey.has(key))updated++;else added++;byKey.set(key,row)}
  const rows=[...byKey.values()].sort((a,b)=>a.month===b.month?a.building.localeCompare(b.building):a.month.localeCompare(b.month));
  const merged={
    format:'bonavista-baseline-v1',
    method:incoming.method||existing?.method,
    generatedAt:incoming.generatedAt||existing?.generatedAt,
    sources:[...(existing?.sources||[]),...(incoming.sources||[])],
    rows
  };
  return {merged,added,updated,kept:rows.length-added-updated};
}
function wireHistoricoImport(){
  const chooseBtn=$('chooseHistorico'),fileInput=$('historicoFile'),doBtn=$('doImportHistorico'),nameEl=$('historicoFileName'),statusEl=$('historicoStatus');
  if(!chooseBtn)return;
  chooseBtn.onclick=()=>fileInput.click();
  fileInput.addEventListener('change',event=>{const file=event.target.files[0];nameEl.textContent=file?file.name:'Ningún archivo elegido';doBtn.disabled=!file;statusEl.classList.remove('error');statusEl.textContent=''});
  doBtn.onclick=async()=>{
    const file=fileInput.files[0];if(!file)return;
    doBtn.disabled=true;statusEl.classList.remove('error');statusEl.textContent='Leyendo el archivo…';
    try{
      if(file.size>25e6)throw Error('Archivo demasiado grande');
      const data=JSON.parse(await file.text());
      if(data.format&&data.format.startsWith('bonavista-dashboard-backup'))throw Error('Esto es una copia de seguridad, no un archivo de histórico: usa «Elegir archivo de copia…» + «Restaurar» más arriba, no este botón.');
      if(data.format!=='bonavista-baseline-v1'||!Array.isArray(data.rows))throw Error('No es un archivo de histórico válido');
      for(const row of data.rows){if(typeof row.month!=='string'||typeof row.building!=='string'||!Array.isArray(row.bookedByDay))throw Error('Fila de histórico dañada')}
      const {merged,added,updated,kept}=mergeHistorico(historical,data);
      localStorage.setItem(BASELINE_KEY,JSON.stringify(merged));
      historical=merged;
      const months=[...new Set(merged.rows.map(r=>r.month))].sort();
      statusEl.textContent='✓ Histórico combinado: '+added+' filas nuevas, '+updated+' actualizadas, '+kept+' ya existentes conservadas sin tocar. Total '+merged.rows.length+' filas ('+(months[0]||'')+' a '+(months.at(-1)||'')+'). Ya se compara en Evolución y se incluirá en la próxima copia de seguridad.';
      fileInput.value='';nameEl.textContent='Ningún archivo elegido';
      if(typeof saveVersionToFolderIfConnected==='function')await saveVersionToFolderIfConnected();
      if(payload&&typeof render==='function')render();
    }catch(e){statusEl.textContent='No se pudo importar: '+e.message;statusEl.classList.add('error')}
    finally{doBtn.disabled=false}
  };
}
wireHistoricoImport();
function previousYearComparison(){
  if(!payload||!historical)return null;
  const current=($('month').value||defaultAnchorMonth());
  if(!current)return null;
  const previous=String(Number(current.slice(0,4))-1)+current.slice(4);
  const building=selectedBuilding();
  const rows=historical.rows.filter(x=>x.month===previous&&(!building||matchBuilding(x.building,building)));
  if(!rows.length)return null;
  const asOf=window.PORTFOLIO_ASOF?.[current]||payload.meta.as_of||new Date().toISOString().slice(0,10);
  const day=Math.max(1,Math.min(31,Number(asOf.slice(8,10))||1));
  return {current,previous,day,priorAtCut:rows.reduce((s,x)=>s+(Number(x.bookedByDay?.[day-1])||0),0),priorFinal:rows.reduce((s,x)=>s+(Number(x.final)||0),0),priorCancelled:rows.reduce((s,x)=>s+(Number(x.cancelledNights)||0),0),source:historical.method};
}
function renderPace(){
  if(!payload)return;
  const comparison=previousYearComparison();
  const asOfValue=window.PORTFOLIO_ASOF?.[comparison?.current]||payload.meta.as_of||'';
  $('asOfDate').value=asOfValue;
  if($('asOfText'))$('asOfText').textContent=asOfValue?'Datos a '+new Date(asOfValue).toLocaleDateString('es-ES')+' · última carga':'';
  if(!comparison){
    $('pace').innerHTML=`<p class="note">Importa el histórico de 2025 para comparar la producción en cartera a la fecha de corte con la cifra de cierre del mismo mes anterior.</p>`;
    return;
  }
  const current=latest().filter(x=>x.month===comparison.current&&(matchBuilding(x.building,selectedBuilding()))).reduce((s,x)=>s+x.gross,0);
  const monthNow=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit'}).format(new Date());
  const openMonth=comparison.current===monthNow;
  const vals=openMonth?[current,comparison.priorAtCut,comparison.priorFinal]:[current,comparison.priorFinal],max=Math.max(...vals,1);
  const currentBuildings=new Set(latest().filter(x=>x.month===comparison.current).map(x=>x.building));
  const priorBuildings=new Set(historical.rows.filter(x=>x.month===comparison.previous).map(x=>x.building));
  const portfolioNote=(!selectedBuilding()&&[...currentBuildings].some(x=>!priorBuildings.has(x)))?' Aviso: la cartera actual contiene edificios que no figuran en el histórico anterior; el porcentaje agregado no es comparable a perímetro constante.':'';
  const lines=openMonth?[
    [comparison.previous+' · CIERRE',money(comparison.priorFinal),'final'],
    ['En cartera '+comparison.current+' · a '+comparison.day,money(current),'current'],
    [comparison.previous+' · a '+comparison.day,money(comparison.priorAtCut),'prior']
  ]:[
    [comparison.current+' · mes cerrado',money(current),'current'],
    [comparison.previous+' · mes cerrado',money(comparison.priorFinal),'final']
  ];
  const widths=openMonth?[comparison.priorFinal,current,comparison.priorAtCut]:[current,comparison.priorFinal];
  const priorMonthDate=new Date(Date.UTC(Number(comparison.current.slice(0,4)),Number(comparison.current.slice(5,7))-2,1)).toISOString().slice(0,7);
  const priorMonthRows=latest().filter(x=>x.month===priorMonthDate&&(matchBuilding(x.building,selectedBuilding())));
  const priorMonthTotal=priorMonthRows.reduce((s,x)=>s+(x.gross||0),0);
  const delta=(value,base)=>base>0?pct((value-base)/base):'—';
  const progress=comparison.priorFinal>0?Math.round(100*current/comparison.priorFinal):null;
  $('pace').innerHTML=`${openMonth?`<div class="pace-goal"><span>CIERRE ${safe(comparison.previous)} · REFERENCIA A ALCANZAR</span><strong>${safe(money(comparison.priorFinal))}</strong><div class="pace-goal-progress"><i style="width:${Math.min(100,Math.max(0,progress||0))}%"></i></div><small>${progress===null?'Sin referencia':safe(String(progress)+' % del cierre anterior')} · diferencia ${safe(money(current-comparison.priorFinal))}</small></div>`:''}<div class="pace-grid">${lines.map(([name,value,kind],i)=>`<div class="pace-line"><div><b>${safe(name)}</b><strong>${safe(value)}</strong></div><div class="pace-track"><div class="pace-fill ${kind}" style="width:${100*widths[i]/max}%"></div></div></div>`).join('')}</div><div class="pace-deltas"><div><span>Vs mes pasado · ${safe(priorMonthDate)}</span><strong>${priorMonthRows.length?safe(delta(current,priorMonthTotal)):'—'}</strong></div><div><span>Ventas vs AA ${openMonth?'· mismo día':'· cierre'}</span><strong>${safe(delta(current,openMonth?comparison.priorAtCut:comparison.priorFinal))}</strong></div></div><p class="note">${openMonth?`El mes actual se compara con el mismo día del año anterior; la meta muestra cómo terminó aquel mes. La cifra de ${comparison.previous} al día ${comparison.day} se reconstruye con fecha de reserva y estado final.`:'Ambos meses están cerrados y se comparan por su cierre completo.'} Vs mes pasado compara la producción de cada mes por fecha de estancia, no las reservas nuevas captadas; requiere una carga del mes anterior.${safe(portfolioNote)}</p>`;
  const previousMonthCard=[...document.querySelectorAll('[data-metric="gross"]')].find(x=>x.querySelector('span')?.textContent==='Ventas vs. mismo mes anterior');
  if(previousMonthCard&&comparison.priorFinal>0){
    previousMonthCard.querySelector('strong').textContent=pct((current-comparison.priorFinal)/comparison.priorFinal);
    previousMonthCard.querySelector('em').textContent='Vs cierre completo de '+comparison.previous;
  }
  const year=comparison.previous.slice(0,4),month=Number(comparison.previous.slice(5,7));
  const historicYTD=historical.rows.filter(x=>x.month.startsWith(year)&&Number(x.month.slice(5,7))<=month&&(matchBuilding(x.building,selectedBuilding()))).reduce((s,x)=>s+Number(x.final||0),0);
  const currentYTD=latest().filter(x=>x.month.startsWith(String(Number(year)+1))&&Number(x.month.slice(5,7))<=month&&(matchBuilding(x.building,selectedBuilding())));
  const coverage=new Set(currentYTD.map(x=>x.month)).size;
  const cumulativeCard=[...document.querySelectorAll('[data-metric="gross"]')].find(x=>x.querySelector('span')?.textContent==='Acumulado vs. año anterior');
  if(cumulativeCard&&historicYTD>0){
    cumulativeCard.querySelector('strong').textContent=coverage===month?pct((currentYTD.reduce((s,x)=>s+x.gross,0)-historicYTD)/historicYTD):'—';
    cumulativeCard.querySelector('em').textContent=coverage===month?'Comparación acumulada hasta '+comparison.current:'Faltan meses del año actual: '+coverage+'/'+month;
  }
}
function renderHistoricalTrends(){
  const holder=$('historicalTrends');
  if(!historical){holder.innerHTML='<h2>Producción mensual · evolución</h2><p class="note">Importa el histórico agregado para ver las series de años anteriores.</p>';return}
  const building=selectedBuilding(),year=Number(($('month').value||defaultAnchorMonth()||'2026').slice(0,4));
  const years=[year-2,year-1,year],current=latest().filter(x=>!building||matchBuilding(x.building,building));
  const series=years.map(y=>Array.from({length:12},(_,i)=>{
    const month=`${y}-${String(i+1).padStart(2,'0')}`;
    return y===year?current.filter(x=>x.month===month).reduce((s,x)=>s+x.gross,0):historical.rows.filter(x=>x.month===month&&(!building||matchBuilding(x.building,building))).reduce((s,x)=>s+Number(x.final||0),0)
  }));
  const max=Math.max(1,...series.flat()),labels=['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  holder.innerHTML=`<h2>Producción mensual · ${years.join(' / ')}</h2><div class="history-legend">${years.map((y,i)=>`<span><i class="${['old','prior','current'][i]}"></i>${y}</span>`).join('')}</div><div class="history-chart">${labels.map((label,m)=>`<div class="history-month"><div class="history-bars">${years.map((y,i)=>`<div class="history-bar ${['old','prior','current'][i]}" style="height:${Math.max(0,160*series[i][m]/max)}px" title="${y}-${m+1}: ${money(series[i][m])}"></div>`).join('')}</div><span>${label}</span></div>`).join('')}</div><p class="note">La serie ${year} representa únicamente los meses presentes en las cargas actuales; los años anteriores reflejan el cierre final de reservas confirmadas.</p>`;
}
const originalRenderBaseline=render;
render=function(){originalRenderBaseline();renderPace();renderSimulatedBanner()};
renderSimulatedBanner();
initBaseline();
