/* Carpeta local (Chrome/Edge, File System Access API): fuente de verdad opcional.
   Guarda automáticamente una nueva versión del dashboard en "Dashboards guardados" cada vez que
   se procesa una carga nueva, y al abrir la página recupera la versión más reciente de esa carpeta
   sin pasos manuales. En navegadores sin soporte (Firefox, Safari) esta función simplemente no
   aparece y el flujo manual de Guardar/Restaurar copia sigue funcionando igual que siempre. */
const FOLDER_DB='bonavista-folder-v1';
const SAVED_SUBFOLDER='Dashboards guardados';
const EXPORTS_SUBFOLDER='Exportaciones BOOKIPRO';
function supportsFolderAccess(){return typeof window.showDirectoryPicker==='function'}
function folderDb(){return new Promise((resolve,reject)=>{const r=indexedDB.open(FOLDER_DB,1);r.onupgradeneeded=()=>r.result.createObjectStore('handle');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
async function getStoredFolderHandle(){
  const db=await folderDb();
  const handle=await new Promise((resolve,reject)=>{const t=db.transaction('handle');const q=t.objectStore('handle').get('root');q.onsuccess=()=>resolve(q.result||null);q.onerror=()=>reject(q.error)});
  db.close();
  return handle;
}
async function setStoredFolderHandle(handle){
  const db=await folderDb();
  await new Promise((resolve,reject)=>{const t=db.transaction('handle','readwrite');t.objectStore('handle').put(handle,'root');t.oncomplete=resolve;t.onerror=()=>reject(t.error)});
  db.close();
}
async function clearStoredFolderHandle(){
  const db=await folderDb();
  await new Promise((resolve,reject)=>{const t=db.transaction('handle','readwrite');t.objectStore('handle').delete('root');t.oncomplete=resolve;t.onerror=()=>reject(t.error)});
  db.close();
}
async function ensureSubfolder(root,name){return root.getDirectoryHandle(name,{create:true})}
/* Primera vez: el usuario elige o crea la carpeta "Bonavista Dashboard" (requiere un clic real). */
async function connectFolder(){
  const root=await window.showDirectoryPicker({id:'bonavista-root',mode:'readwrite',startIn:'documents'});
  await ensureSubfolder(root,SAVED_SUBFOLDER);
  await ensureSubfolder(root,EXPORTS_SUBFOLDER);
  await setStoredFolderHandle(root);
  window.BONAVISTA_FOLDER=root;
  return root;
}
/* Siguientes visitas: recupera la carpeta ya elegida. Si el navegador todavía no ha confirmado el
   permiso de este arranque, devuelve needsPermission=true; el botón "Reconectar" lo resuelve con un clic. */
async function reconnectFolder(){
  const stored=await getStoredFolderHandle();
  if(!stored)return {connected:false};
  const perm=await stored.queryPermission({mode:'readwrite'});
  if(perm!=='granted')return {connected:false,needsPermission:true,handle:stored};
  window.BONAVISTA_FOLDER=stored;
  return {connected:true,handle:stored};
}
async function requestFolderPermission(handle){
  const perm=await handle.requestPermission({mode:'readwrite'});
  if(perm==='granted'){window.BONAVISTA_FOLDER=handle;return true}
  return false;
}
function folderVersionFilename(iso){return typeof dashboardCopyFilename==='function'?dashboardCopyFilename(iso):'Copia de dashboard '+iso.replace(/:/g,'-').replace(/\..+/,'').replace('T',' ')+'.bonavista'}
async function listSavedVersions(root){
  const dir=await ensureSubfolder(root,SAVED_SUBFOLDER);
  const files=[];
  for await (const [name,entry] of dir.entries()){if(entry.kind==='file'&&name.endsWith('.bonavista'))files.push(name)}
  return files.sort().reverse();
}
async function writeFolderVersion(root,json,iso){
  const dir=await ensureSubfolder(root,SAVED_SUBFOLDER);
  const filename=folderVersionFilename(iso);
  const fileHandle=await dir.getFileHandle(filename,{create:true});
  const writable=await fileHandle.createWritable();
  await writable.write(json);
  await writable.close();
  return filename;
}
async function readFolderVersion(root,filename){
  const dir=await ensureSubfolder(root,SAVED_SUBFOLDER);
  const fileHandle=await dir.getFileHandle(filename);
  const file=await fileHandle.getFile();
  return file.text();
}
async function deleteFolderVersion(root,filename){
  const dir=await ensureSubfolder(root,SAVED_SUBFOLDER);
  await dir.removeEntry(filename);
}
/* Guarda una nueva versión en la carpeta si hay una conectada; no hace nada si no la hay (o si el
   navegador no soporta la función), para no interrumpir el flujo normal. */
async function saveVersionToFolderIfConnected(){
  if(!window.BONAVISTA_FOLDER)return null;
  try{
    const {now,json}=await buildBackupPayload();
    return await writeFolderVersion(window.BONAVISTA_FOLDER,json,now);
  }catch(e){
    if(/Todavía no hay datos/.test(e.message))return null;
    console.warn('No se pudo guardar la versión en la carpeta:',e);
    return null;
  }
}
/* Al abrir, si hay carpeta conectada, carga la versión más reciente guardada en ella. */
async function loadLatestFromFolderIfConnected(){
  if(!window.BONAVISTA_FOLDER)return false;
  const versions=await listSavedVersions(window.BONAVISTA_FOLDER);
  if(!versions.length)return false;
  const json=await readFolderVersion(window.BONAVISTA_FOLDER,versions[0]);
  const result=await restoreBackupObject(JSON.parse(json));
  return result;
}
