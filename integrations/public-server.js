'use strict';
/* Run locally with Node and Playwright. The dashboard calls this on demand. */
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {flattenJsonLd,ratingFromJsonLd,ratingFromPage,categoriesFromPage,countFromText}=require('./extract-public');
const CONFIG=path.join(__dirname,'public-pages.json');
const PORT=Number(process.env.BONAVISTA_PORT||8765),ALLOWED_HOSTS=new Set(['www.booking.com','www.expedia.com','www.expedia.es','www.airbnb.com','www.google.com','maps.google.com']);
// Competitors are tracked to benchmark Bonavista, not scraped from Booking/Expedia: those
// restrict automated access in their terms. Only Google's public map listing is read for them.
const COMPETITOR_ALLOWED_PLATFORMS=new Set(['Google']);
function validated(raw){const url=new URL(raw);if(url.protocol!=='https:'||!ALLOWED_HOSTS.has(url.hostname))throw Error('Dominio no admitido: '+url.hostname);return url.toString();}
function send(res,status,body){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(body));}
async function collect(browserCtx,profile){const page=await browserCtx.newPage({locale:'es-ES',timezoneId:'Europe/Madrid'});try{await page.addInitScript(`const flattenJsonLd=${flattenJsonLd.toString()};const ratingFromJsonLd=${ratingFromJsonLd.toString()};const countFromText=${countFromText.toString()};window.__bonavistaRating=${ratingFromPage.toString()};window.__bonavistaCategories=${categoriesFromPage.toString()};`);
 const response=await page.goto(validated(profile.url),{waitUntil:'domcontentloaded',timeout:25000});if(!response||response.status()>=400)throw Error('HTTP '+(response?.status()||'sin respuesta'));
 // Some sites (seen on Booking) show an interim page and reload to the real one right after
 // domcontentloaded; reading too early destroys the evaluate context mid-navigation. Wait for
 // the page to actually settle before touching it, same as a human visitor would experience.
 await page.waitForLoadState('networkidle',{timeout:15000}).catch(()=>{});
 if(profile.platform==='Google'){
  // Google shows an EU cookie-consent interstitial before the map; reject all (no tracking
  // needed to read a public rating) so the real page loads. Any visitor sees this same screen.
  await page.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.getAttribute('aria-label')==='Rechazar todo'||x.getAttribute('aria-label')==='Reject all');if(b)b.click()}).catch(()=>{});
  await page.waitForLoadState('networkidle',{timeout:8000}).catch(()=>{});
 }
 await page.waitForTimeout(1000);const info=await page.evaluate(({platform})=>{
  // A function cannot import CommonJS in a page. It is injected separately.
  return {rating:window.__bonavistaRating(document,platform),categories:window.__bonavistaCategories(document,platform)};
  },{platform:profile.platform});if(!info.rating)throw Error('Nota no visible en esta ficha');const scale=profile.platform==='Airbnb'||profile.platform==='Google'?5:10;const score=info.rating.scale&&info.rating.scale!==scale?Math.round(info.rating.score/info.rating.scale*scale*100)/100:info.rating.score;if(score<0||score>scale)throw Error('Escala de nota inesperada');
  const result={platform:profile.platform,building:profile.building,score,categories:info.categories,capturedAt:new Date().toISOString(),source:profile.url};
  if(info.rating.count)result.reviewCount=info.rating.count;
  if(profile.competitor)Object.assign(result,{competitor:profile.competitor,postalCode:profile.postalCode||'',businessType:profile.businessType||''});
  return result;
 }finally{await page.close()}}
async function refresh(){let playwright;try{playwright=require('playwright')}catch{throw Error('Instala Playwright: npm install --prefix integrations')};const config=JSON.parse(fs.readFileSync(CONFIG,'utf8')),errors=[];
 const ownTasks=(config.profiles||[]).map(p=>({...p}));
 const competitorTasks=(config.competitors||[]).map(c=>({...c}));
 const skipped=competitorTasks.filter(c=>!COMPETITOR_ALLOWED_PLATFORMS.has(c.platform));
 for(const c of skipped)errors.push({platform:c.platform,building:c.competitor||c.building,error:'Plataforma no habilitada para competidores (solo Google): evita el riesgo de condiciones de uso de Booking/Expedia'});
 const tasks=[...ownTasks,...competitorTasks.filter(c=>COMPETITOR_ALLOWED_PLATFORMS.has(c.platform))];
 // Headless Chromium behaves differently enough from a real browser window that some sites
 // (Expedia, in testing) block it outright even on a single, isolated request; a normal
 // (non-headless) window is not evasion, just Playwright's other standard launch mode, and
 // needs a real desktop session to open — set BONAVISTA_HEADFUL=0 to force headless back.
 const browser=await playwright.chromium.launch({headless:process.env.BONAVISTA_HEADFUL==='0'});
 let reviews=[];
 try{
  // Parallel ACROSS sites (Booking/Expedia/Airbnb/Google all at once), but one request
  // at a time PER SITE: hitting the same host 4x at once got Expedia to answer HTTP 429.
  const byHost=new Map();
  for(const task of tasks){const host=new URL(task.url).hostname;if(!byHost.has(host))byHost.set(host,[]);byHost.get(host).push(task)}
  const perHost=async group=>{const out=[];for(const task of group){try{out.push({ok:true,value:await collect(browser,task)})}catch(e){out.push({ok:false,task,error:e.message})}if(group.length>1)await new Promise(r=>setTimeout(r,800))}return out};
  const grouped=await Promise.all([...byHost.values()].map(perHost));
  const outcomes=grouped.flat();
  for(const o of outcomes){if(o.ok)reviews.push(o.value);else errors.push({platform:o.task.platform,building:o.task.competitor||o.task.building,error:o.error})}
 // Prices need a configured property and a verified total for an exact stay;
 // ambiguous page cards are deliberately not interpreted as prices.
 }finally{await browser.close()}
 const rates=[];
 return {format:'bonavista-market-v1',reviews,rates,errors};}
const server=http.createServer(async(req,res)=>{const origin=req.headers.origin||'';if(origin&&!/^https:\/\/ignmm\.github\.io$/.test(origin)&&origin!=='null'){send(res,403,{error:'Origen no autorizado'});return}if(req.method==='OPTIONS'){res.writeHead(204,{'Access-Control-Allow-Origin':origin||'null','Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type'});res.end();return}res.setHeader('Access-Control-Allow-Origin',origin||'null');if(req.method==='POST'&&req.url==='/api/market-refresh'){try{send(res,200,await refresh())}catch(e){send(res,503,{error:e.message})}return}send(res,404,{error:'No encontrado'})});server.listen(PORT,'127.0.0.1',()=>console.log('Bonavista lector local: http://127.0.0.1:'+PORT));
