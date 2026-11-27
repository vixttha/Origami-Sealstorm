import { chromium } from 'playwright';
import fs from 'node:fs';
const game=process.env.GAME;
const config={
 neon:{start:'#start-game-btn',shop:'[data-element="air"]',wave:'#btn-wave',pause:'#btn-pause',speed:'#btn-spd-3',ink:'#hud-ink',codex:'#hud-codex-btn'},
 argon:{start:'[data-testid="start-game-btn"]',shop:'[data-testid="shop-tower-air"]',wave:'[data-testid="start-wave-btn"]',pause:'[data-testid="pause-wave-btn"]',speed:'[data-testid="speed-3x-btn"]',ink:'[data-testid="hud-ink"]',codex:'[data-testid="open-codex-btn"]'},
 claude:{start:'[data-testid="start-game"]',shop:'[data-testid="shop-air"]',wave:'[data-testid="start-wave"]',pause:'[data-testid="pause"]',speed:'[data-testid="speed-3"]',ink:'[data-testid="ink"]',codex:'[data-testid="open-codex"]'},
 glm:{start:'button:has-text("UNROLL THE SCROLL")',shop:'aside button:has-text("Air")',wave:'button:has-text("START WAVE 1")',pause:'button[title="Pause (Space)"]',speed:'button[title="3x speed (key 3)"]',ink:'[title="Ink balance"]',codex:'button:has-text("SCROLL OF SEALS")'}
}[game];
const browser=await chromium.launch({args:['--no-sandbox']});
const context=await browser.newContext({viewport:{width:1280,height:800}});
await context.tracing.start({screenshots:true,snapshots:true,sources:false});
const page=await context.newPage();
page.setDefaultTimeout(6000);
const results=[],errors=[],network=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(m.type()==='error')network.push(m.text())});
async function check(name,fn){try{const detail=await fn();results.push({name,pass:true,detail});}catch(e){results.push({name,pass:false,detail:String(e.message).slice(0,500)});}console.log(JSON.stringify(results.at(-1)));}
const assert=(ok,msg)=>{if(!ok)throw Error(msg)};
const ink=async()=>{const t=await page.locator(config.ink).innerText(); const n=Number(t.match(/\d[\d,]*/)?.[0]?.replaceAll(',',''));assert(Number.isFinite(n),'ink not numeric: '+t);return n};
const click=async(s)=>page.locator(s).first().click();
const open=async()=>{await page.goto('http://127.0.0.1:4173/',{waitUntil:'domcontentloaded'});await page.locator(config.start).first().waitFor()};
const canvas=()=>page.locator('canvas:visible').first();
async function snapshot(){return page.locator('body').innerText().then(x=>x.slice(0,1600))}

// Second pass: exact user-visible actions, isolated contexts on a common desktop.
const mapNames=['Winding Calligraphy River','Twin-Bridge Crossover','The Spiral Shrine'];
const difficulties=['Apprentice Scroll','Master Calligrapher','Grandmaster Seal'];
const lives={neon:'#hud-lives',argon:'[data-testid="hud-lives"]',claude:'[data-testid="lives"]',glm:'[title="Sanctuary lives"]'}[game];
const waveCounter={neon:'#hud-wave',argon:'[data-testid="hud-wave"]',claude:'[data-testid="wave-counter"]',glm:'aside span.font-brush'}[game];
const upgrade={neon:'[data-upgrade="A"]',argon:'[data-testid="upgrade-path-A-btn"]',claude:'[data-testid="upgrade-A-1"]',glm:'aside button:has-text("Rising Winds")'}[game];
const sell={neon:'#btn-salvage',argon:'[data-testid="salvage-tower-btn"]',claude:'[data-testid="sell"]',glm:'button:has-text("SALVAGE")'}[game];
const overclock={neon:'#btn-wave',argon:'[data-testid="overclock-wave-btn"]',claude:'[data-testid="start-wave"]',glm:'button:has-text("SEND NEXT EARLY")'}[game];
const pauseState={neon:'#btn-pause',argon:'[data-testid="pause-wave-btn"]',claude:'[data-testid="pause"]',glm:'button[title*="Resume"]'}[game];
async function choose(map,diff){await open();await page.getByRole('button',{name:new RegExp(mapNames[map],'i')}).first().click();await page.getByRole('button',{name:new RegExp(difficulties[diff],'i')}).first().click();await click(config.start);await canvas().waitFor();await page.waitForTimeout(200)}
async function place(points){const before=await ink();for(const [x,y] of points){await click(config.shop);const b=await canvas().boundingBox();await canvas().click({position:{x:x/960*b.width,y:y/600*b.height}});await page.waitForTimeout(180);const after=await ink();if(after<before)return {before,after,x,y};await page.keyboard.press('Escape');}throw Error('No placement accepted')}
const points=game==='claude'?[[180,120],[360,250],[600,370],[700,255],[250,210],[430,300]]:game==='glm'?[[430,300],[700,255],[250,210]]:[[250,210],[245,265],[535,345],[430,300],[700,255]];
try {
 for(let m=0;m<3;m++)for(let d=0;d<3;d++)await check('map '+m+' difficulty '+d,async()=>{await choose(m,d);const value=await ink();assert(value===[450,375,325][d],'starting ink '+value);const life=await page.locator(lives).first().innerText();assert(Number(life.match(/\d+/)?.[0])===[100,50,1][d],'lives '+life);const c=await canvas().boundingBox();assert(c.width>400&&c.height>200,'desktop canvas too small');return {ink:value,life,canvas:c.width}});
 await check('tower upgrade and refund',async()=>{await choose(0,0);const p=await place(points);const i=await ink();await click(upgrade);await page.waitForTimeout(250);const u=await ink();assert(i-u===85,'upgrade expected 85: '+i+' -> '+u);await click(sell);await page.waitForTimeout(250);const s=await ink();assert(s-u===Math.floor(185*.75),'refund expected 138: '+u+' -> '+s);return {placement:p,afterUpgrade:u,afterSell:s}});
 await check('pause immediately while wave active',async()=>{await choose(0,0);await place(points);await click(config.wave);await click(config.pause);await page.waitForTimeout(100);const label=await page.locator(pauseState).first().evaluate(x=>({title:x.title,text:x.innerText}));assert(/resume|▶/i.test(label.title+' '+label.text),'resume label missing '+JSON.stringify(label));return label});
 await check('first wave completion with active tower',async()=>{await choose(0,0);await place(points);try{await place([...points].reverse())}catch{}await click(config.wave);await click(config.speed);const next={neon:'button#btn-wave:has-text("Send Wave 2")',argon:'[data-testid="start-wave-btn"]:has-text("Start Wave 2")',claude:'[data-testid="start-wave"]:has-text("Start Wave 2")',glm:'button:has-text("START WAVE 2")'}[game];await page.locator(next).first().waitFor({timeout:65000});await page.screenshot({path:'evidence/wave-one-cleared.png'});return await snapshot()});
 await check('overclock target boundary',async()=>{await choose(0,0);await click(config.wave);let clicks=0;for(let n=0;n<27;n++){const b=page.locator(overclock).first();if(!await b.isVisible()||!await b.isEnabled())break;await b.click({timeout:1000});clicks++;await page.waitForTimeout(35)}const wave=await page.locator(waveCounter).first().innerText();const num=Number(wave.match(/\d+/)?.[0]);assert(num<=25,'target exceeded before victory: '+wave+' after '+clicks+' clicks');return {clicks,wave}});
 await check('codex opens',async()=>{await choose(0,0);await click(config.codex);await page.waitForTimeout(200);const text=await snapshot();assert(/steam|reaction|codex/i.test(text),'missing codex contents');await page.screenshot({path:'evidence/codex.png'});return text});
 await check('mobile battlefield fully visible and usable',async()=>{await page.setViewportSize({width:390,height:844});await choose(0,0);const b=await canvas().boundingBox();await page.screenshot({path:'evidence/mobile-battle.png'});assert(b.x>=0&&b.x+b.width<=390&&b.width>=300,JSON.stringify(b));return b});
 await check('uncaught JS exceptions',()=>{assert(errors.length===0,errors.join(' | '));return errors});
} finally {
 fs.writeFileSync('evidence/extended-results.json',JSON.stringify({game,results,errors,consoleErrors:network},null,2));
 console.log('AUDIT_SUMMARY '+JSON.stringify({game,passed:results.filter(r=>r.pass).length,total:results.length,errors,consoleErrors:network}));
 await context.tracing.stop({path:'evidence/extended-trace.zip'});
 await browser.close();
}
if(results.some(r=>!r.pass))process.exitCode=1;
