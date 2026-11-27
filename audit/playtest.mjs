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
try {
 await check('title starts',async()=>{await open();await page.screenshot({path:'evidence/title.png'});return await snapshot()});
 await check('enter battle',async()=>{await click(config.start);await canvas().waitFor();await page.waitForTimeout(600);return await snapshot()});
 await check('canvas renders nonuniform pixels',async()=>{const v=await canvas().evaluate(c=>{const ctx=c.getContext('2d');const d=ctx.getImageData(0,0,c.width,c.height).data;const colors=new Set();for(let i=0;i<d.length;i+=4000)colors.add(d[i]+','+d[i+1]+','+d[i+2]);return {w:c.width,h:c.height,colors:colors.size}});assert(v.w>100&&v.h>100&&v.colors>10,JSON.stringify(v));return v});
 await check('place tower and charge ink',async()=>{const before=await ink();for(const [x,y] of [[430,300],[700,255],[250,210],[300,200],[500,250],[600,350],[250,250],[450,360],[200,200]]){await click(config.shop);const b=await canvas().boundingBox();await canvas().click({position:{x:x/960*b.width,y:y/600*b.height}});await page.waitForTimeout(180);const after=await ink();if(after<before)return {before,after,x,y}; // deselect if invalid
 await page.keyboard.press('Escape');}throw Error('No placement deducted ink')});
 await check('start wave and accelerate',async()=>{await click(config.wave);await click(config.speed);await page.waitForTimeout(3000);await page.screenshot({path:'evidence/combat.png'});return await snapshot()});
 await check('pause control',async()=>{await click(config.pause);await page.waitForTimeout(300);return await snapshot()});
 await check('active battle reload behavior',async()=>{const before=await snapshot();const storage=await page.evaluate(()=>Object.keys(localStorage));await page.reload({waitUntil:'domcontentloaded'});await page.waitForTimeout(500);const title=await page.locator(config.start).first().isVisible();const battle=await canvas().count();await page.screenshot({path:'evidence/reload.png'});return {title,battle,storage,before,after:await snapshot(),resumeObserved:!title&&battle>0}});
 await check('mobile title accessibility',async()=>{await page.setViewportSize({width:390,height:844});await open();await page.screenshot({path:'evidence/mobile-title.png',fullPage:true});return await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth}))});
 await check('mobile battle layout',async()=>{await click(config.start);await canvas().waitFor();await page.waitForTimeout(300);await page.screenshot({path:'evidence/mobile-battle.png'});return await canvas().evaluate(c=>{const r=c.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,viewport:innerWidth,overflow:document.documentElement.scrollWidth-innerWidth}})});
 await check('uncaught JS exceptions',()=>{assert(errors.length===0,errors.join(' | '));return errors});
} finally {
 fs.writeFileSync('evidence/results.json',JSON.stringify({game,results,errors,consoleErrors:network},null,2));
 console.log('AUDIT_SUMMARY '+JSON.stringify({game,passed:results.filter(r=>r.pass).length,total:results.length,errors,consoleErrors:network}));
 await context.tracing.stop({path:'evidence/trace.zip'});
 await browser.close();
}
if(results.some(r=>!r.pass))process.exitCode=1;
