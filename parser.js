/* XLSX/CSV reader. Only analytical columns are retained; guest identity fields are never read into result rows. */
const REQUIRED = ['Id','Fecha reserva','Estado','Edificio','Llegada','Salida','Noches','Precio total','Canal'];
const OPTIONAL = ['País','Tarifas','Num. personas','Precio alquiler','Precio tasa turística','Precio de descuento','Alojamiento','Categoría'];
const xml = text => {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if (doc.querySelector('parsererror')) throw Error('El Excel contiene XML no válido');
  return doc;
};
const nodes = (parent, tag) => [...parent.getElementsByTagName(tag)];
const value = raw => {
  if (raw === undefined || raw === null || raw === '') return 0;
  const n = Number(String(raw).replace(',', '.'));
  if (!Number.isFinite(n)) throw Error('Un valor numérico no es válido');
  return n;
};
function date(raw) {
  if (typeof raw === 'number' || /^\d{5}(\.\d+)?$/.test(String(raw))) {
    const d = new Date(Date.UTC(1899, 11, 30) + Number(raw) * 86400000);
    return d.toISOString().slice(0,10);
  }
  const match = String(raw ?? '').match(/^(\d{4})-(\d\d)-(\d\d)/);
  if (!match || Number.isNaN(Date.parse(match[0]))) throw Error('Fecha no válida: ' + String(raw).slice(0,20));
  return match[0];
}
const days = (a,b) => Math.round((Date.parse(a+'T00:00:00Z')-Date.parse(b+'T00:00:00Z'))/86400000);
async function readXlsx(file) {
  if (!window.JSZip) throw Error('No se ha cargado el lector de Excel');
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const wbFile = zip.file('xl/workbook.xml');
  const relFile = zip.file('xl/_rels/workbook.xml.rels');
  if (!wbFile || !relFile) throw Error('No es un libro XLSX válido');
  const wb = xml(await wbFile.async('string'));
  const rels = xml(await relFile.async('string'));
  const first = nodes(wb,'sheet')[0];
  if (!first) throw Error('El Excel no tiene hojas');
  const rid = first.getAttribute('r:id') || first.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','id');
  const relation = nodes(rels,'Relationship').find(r => r.getAttribute('Id') === rid);
  if (!relation) throw Error('No se encuentra la primera hoja');
  const target = relation.getAttribute('Target');
  const path = target.startsWith('/') ? target.slice(1) : 'xl/' + target.replace(/^\.\.\//,'');
  const sheetFile = zip.file(path);
  if (!sheetFile) throw Error('No se puede leer la hoja de reservas');
  const stringsFile = zip.file('xl/sharedStrings.xml');
  const strings = stringsFile ? nodes(xml(await stringsFile.async('string')),'si').map(si => nodes(si,'t').map(t => t.textContent).join('')) : [];
  const sheet = xml(await sheetFile.async('string'));
  const rows = nodes(sheet,'row');
  const cellValue = c => {
    const type = c.getAttribute('t');
    if (type === 'inlineStr') return nodes(c,'t').map(t=>t.textContent).join('');
    const v = nodes(c,'v')[0]?.textContent ?? '';
    return type === 's' ? strings[Number(v)] ?? '' : v;
  };
  const columns = row => {
    const output = new Map();
    for (const c of nodes(row,'c')) {
      const ref = c.getAttribute('r') || '';
      const letters = ref.match(/^[A-Z]+/)?.[0];
      if (!letters) continue;
      let idx = 0;
      for (const letter of letters) idx = idx * 26 + letter.charCodeAt(0) - 64;
      output.set(idx-1, cellValue(c));
    }
    return output;
  };
  if (!rows.length) throw Error('El Excel está vacío');
  const headers = columns(rows[0]);
  const indices = {};
  for (const name of REQUIRED.concat(OPTIONAL)) {
    const index = [...headers.entries()].find(([,v])=>String(v).trim() === name)?.[0];
    if (index === undefined && REQUIRED.includes(name)) throw Error('Falta la columna '+name);
    if (index !== undefined) indices[name] = index;
  }
  const bookings = new Map();
  for (const row of rows.slice(1)) {
    const cells = columns(row), get = name => cells.get(indices[name]) ?? '';
    const id = String(get('Id')).trim();
    if (!id) continue;
    if (bookings.has(id)) throw Error('ID duplicado: '+id);
    const arrival=date(get('Llegada')), departure=date(get('Salida')), booked=date(get('Fecha reserva'));
    const nights=value(get('Noches'));
    bookings.set(id,{
      id, month:arrival.slice(0,7), arrival, departure, apartment:String(get('Alojamiento')||'Sin apartamento'), roomType:String(get('Categoría')||'Sin categoría'), building:String(get('Edificio')||'Sin edificio'),
      channel:String(get('Canal')||'Sin canal'), country:String(get('País')||'Sin país'),
      rate:String(get('Tarifas')||'Sin tarifa'), status:String(get('Estado')),
      nights, guests:get('Num. personas') === '' ? null : value(get('Num. personas')),
      gross:value(get('Precio total')), rental:value(get('Precio alquiler')),
      discount:value(get('Precio de descuento')),
      tax:value(get('Precio tasa turística')), lead:days(arrival,booked),
      date_warning:days(departure,arrival) !== nights
    });
  }
  if (!bookings.size) throw Error('No hay reservas en el Excel');
  return bookings;
}
function csvRows(text) {
  const rows=[], current=[];let field='', quoted=false;
  text=text.replace(/^\uFEFF/,'');
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(c==='"'){
      if(quoted && text[i+1]==='"'){field+='"';i++} else quoted=!quoted;
    }else if(c===';'&&!quoted){current.push(field);field=''}
    else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;current.push(field);if(current.some(x=>x!==''))rows.push(current.slice());current.length=0;field=''}
    else field+=c;
  }
  if(quoted)throw Error('CSV con comillas sin cerrar');
  if(field||current.length){current.push(field);rows.push(current)}
  return rows;
}
async function analyseFiles(bookFile,serviceFile){
  const bookings=await readXlsx(bookFile), rows=csvRows(await serviceFile.text());
  const header=rows.shift()||[];const col=name=>{const i=header.indexOf(name);if(i<0)throw Error('Falta la columna '+name+' en el CSV');return i};
  const idCol=col('ID'), conceptCol=col('concept'), amountCol=col('amount');
  const services=new Map();let serviceLines=0;
  for(const row of rows){const id=String(row[idCol]||'').trim();if(!id)continue;serviceLines++;const concept=String(row[conceptCol]||'').trim(),amount=value(row[amountCol]);if(!services.has(id))services.set(id,new Map());const items=services.get(id);items.set(concept,(items.get(concept)||0)+amount)}
  const missing=[...bookings.keys()].filter(id=>!services.has(id)),orphan=[...services.keys()].filter(id=>!bookings.has(id));
  if(missing.length||orphan.length)throw Error(`Los archivos no coinciden: ${missing.length} reservas sin servicios y ${orphan.length} servicios sin reserva`);
  const DUPLICATE_CONCEPTS=new Set(['total extras','rental','tourist tax']);
  for(const [id,b] of bookings){const components=services.get(id);b.service_total=[...components].reduce((s,[name,v])=>s+(name==='Total extras'?0:v),0);b.cleaning=[...components].reduce((s,[name,v])=>s+(name.includes('Limpieza final')?v:0),0);b.reconciliation_delta=Math.round((b.gross-(b.service_total-b.discount))*100)/100;b.serviceItems=Object.fromEntries([...components].filter(([name])=>!DUPLICATE_CONCEPTS.has(name.trim().toLowerCase())))}
  const all=[...bookings.values()], items=all.filter(b=>b.status.toLowerCase()==='confirmed');
  if (!items.length) throw Error('No hay reservas confirmadas en esta exportación');
  const cancelledMap=new Map();for(const b of all){if(!b.status.toLowerCase().startsWith('cancelled'))continue;const k=b.month+'|'+b.building,e=cancelledMap.get(k)??{month:b.month,building:b.building,nights:0,bookings:0,gross:0};e.nights+=b.nights;e.bookings++;e.gross+=b.gross;cancelledMap.set(k,e)}
  const cancelled=[...cancelledMap.values()].map(e=>({...e,gross:Math.round(e.gross*100)/100}));
  const fileDate=bookFile.name.match(/(20\d{2})-(\d{2})-(\d{2})/);
  const simulated=/SIMULAD/i.test(bookFile.name)||/SIMULAD/i.test(serviceFile.name);
  if(simulated)for(const b of items)b.simulated=true;
  return {bookings:items,meta:{as_of:fileDate?`${fileDate[1]}-${fileDate[2]}-${fileDate[3]}`:new Date().toISOString().slice(0,10),reservations:items.length,excluded_reservations:all.length-items.length,service_lines:serviceLines,date_warnings:items.filter(b=>b.date_warning).length,reconciliation_warnings:items.filter(b=>Math.abs(b.reconciliation_delta)>0.02).length,status_counts:Object.fromEntries([...new Set(all.map(b=>b.status))].map(x=>[x,all.filter(b=>b.status===x).length])),channel_coverage:items.filter(b=>b.channel!=='Sin canal').length,cancelled,simulated}};
}
