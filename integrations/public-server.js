'use strict';
/* Run locally with Node and Playwright. The dashboard calls this on demand. */
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {flattenJsonLd,ratingFromJsonLd,ratingFromPage,categoriesFromPage}=require('./extract-public');
const CONFIG=path.join(__dirname,'public-pages.json');
const PORT=Number(process.env.BONAVISTA_PORT||8765),ALLOWED_HOSTS=new Set(['www.booking.com','www.expedia.com','www.airbnb.com','www.google.com','maps.google.com']);
const CONCURRENCY=Math.max(1,Number(process.env.BONAVISTA_CONCURRENCY||4));
// Competitors are tracked to benchmark Bonavista, not scraped from Booking/Expedia: those
// restrict automated access in their terms. Only Google's public map listing is read for them.
const COMPETITOR_ALLOWED_PLATFORMS=new Set(['Google']);
function validated(raw){const url=new URL(raw);if(url.protocol!=='https:'||!ALLOWED_HOSTS.has(url.hostname))throw Error('Dominio no admitido: '+url.hostname);return url.toString();}
function send(res,status,body){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(body));}
async function pMap(items,limit,fn){const results=new Array(items.length);let next=0;async function worker(){while(next<items.length){const i=next++;results[i]=await fn(items[i],i)}}await Promise.all(Array.from({length:Math.min(limit,items.length)},worker));return results}
async function collect(browserCtx,profile){const page=await browserCtx.newPage({locale:'es-ES',timezoneId:'Europe/Madrid'});try{await page.addInitScript(`const flattenJsonLd=${flattenJsonLd.toString()};const ratingFromJsonLd=${ratingFromJsonLd.toString()};window.__bonavistaRating=${ratingFromPage.toString()};window.__bonavistaCategories=${categoriesFromPage.toString()};`);
 const response=await page.goto(validated(profile.url),{waitUntil:'domcontentloaded',timeout:25000});if(!response||response.status()>=400)throw Error('HTTP '+(response?.status()||'sin respuesta'));await page.waitForTimeout(1200);const info=await page.evaluate(({platform})=>{
  // A function cannot import CommonJS in a page. It is injected separately.
  return {rating:window.__bonavistaRating(document,platform),categories:window.__bonavistaCategories(document,platform)};
  },{platform:profile.platform});if(!info.rating)throw Error('Nota no visible en esta ficha');const scale=profile.platform==='Airbnb'||profile.platform==='Google'?5:10;const score=info.rating.scale&&info.rating.scale!==scale?Math.round(info.rating.score/info.rating.scale*scale*100)/100:info.rating.score;if(score<0||score>scale)throw Error('Escala de nota inesperada');
  const result={platform:profile.platform,building:profile.building,score,categories:info.categories,capturedAt:new Date().toISOString(),source:profile.url};
  if(profile.competitor)Object.assign(result,{competitor:profile.competitor,postalCode:profile.postalCode||'',businessType:profile.businessType||''});
  return result;
 }finally{await page.close()}}
async function refresh(){let playwright;try{playwright=require('playwright')}catch{throw Error('Instala Playwright: npm install --prefix integrations')};const config=JSON.parse(fs.readFileSync(CONFIG,'utf8')),errors=[];
 const ownTasks=(config.profiles||[]).map(p=>({...p}));
 const competitorTasks=(config.competitors||[]).map(c=>({...c}));
 const skipped=competitorTasks.filter(c=>!COMPETITOR_ALLOWED_PLATFORMS.has(c.platform));
 for(const c of skipped)errors.push({platform:c.platform,building:c.competitor||c.building,error:'Plataforma no habilitada para competidores (solo Google): evita el riesgo de condiciones de uso de Booking/Expedia'});
 const tasks=[...ownTasks,...competitorTasks.filter(c=>COMPETITOR_ALLOWED_PLATFORMS.has(c.platform))];
 const browser=await playwright.chromium.launch({headless:true});
 let reviews=[];
 try{
  // Each task runs on its own page/tab; up to CONCURRENCY at once, not one page reused in sequence.
  const outcomes=await pMap(tasks,CONCURRENCY,async task=>{try{return {ok:true,value:await collect(browser,task)}}catch(e){return {ok:false,task,error:e.message}}});
  for(const o of outcomes){if(o.ok)reviews.push(o.value);else errors.push({platform:o.task.platform,building:o.task.competitor||o.task.building,error:o.error})}
 // Prices need a configured property and a verified total for an exact stay;
 // ambiguous page cards are deliberately not interpreted as prices.
 }finally{await browser.close()}
 const rates=[];
 return {format:'bonavista-market-v1',reviews,rates,errors};}
const server=http.createServer(async(req,res)=>{const origin=req.headers.origin||'';if(origin&&!/^https:\/\/ignmm\.github\.io$/.test(origin)&&origin!=='null'){send(res,403,{error:'Origen no autorizado'});return}if(req.method==='OPTIONS'){res.writeHead(204,{'Access-Control-Allow-Origin':origin||'null','Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type'});res.end();return}res.setHeader('Access-Control-Allow-Origin',origin||'null');if(req.method==='POST'&&req.url==='/api/market-refresh'){try{send(res,200,await refresh())}catch(e){send(res,503,{error:e.message})}return}send(res,404,{error:'No encontrado'})});server.listen(PORT,'127.0.0.1',()=>console.log('Bonavista lector local: http://127.0.0.1:'+PORT));
