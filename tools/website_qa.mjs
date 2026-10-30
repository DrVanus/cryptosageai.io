#!/usr/bin/env node
// Run on Studio after sourcing Toolchains/enable-macbook-toolchain.sh.
// node tools/website_qa.mjs --out /tmp/cryptosage-web-review-20261030/chromium
// Add --browser webkit for Safari-engine coverage. --url URL checks a served site.
// No installs. Local tree is served on an ephemeral port. No signup is submitted.
import assert from 'node:assert/strict';
import http from 'node:http';
import { readFile, stat, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
const require = createRequire(import.meta.url);
const playwright = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const argv = process.argv.slice(2), arg = (n,d) => argv.includes(n) ? argv[argv.indexOf(n)+1] : d;
const root = path.resolve(arg('--root', path.join(path.dirname(fileURLToPath(import.meta.url)), '..')));
const out = path.resolve(arg('--out','/tmp/cryptosage-web-review-20261030/browser'));
const engine = arg('--browser','chromium');
assert(['chromium','webkit'].includes(engine));
await mkdir(out,{recursive:true});
const mime = { '.html':'text/html','.css':'text/css','.js':'application/javascript','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.ico':'image/x-icon','.woff2':'font/woff2','.json':'application/json' };
let server, url=arg('--url',null);
if(!url) {
  server=http.createServer(async(req,res)=>{
    try {
      const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
      const file=path.resolve(root,'.'+name+(name.endsWith('/')?'index.html':''));
      if(!file.startsWith(root+path.sep)||!(await stat(file)).isFile())throw Error('not found');
      res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});
      res.end(await readFile(file));
    }catch {res.writeHead(404);res.end('Not found');}
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  url='http://127.0.0.1:'+server.address().port+'/';
}
const origin=new URL(url).origin;
const report={schema:'cryptosage-website-browser-qa/v1',startedAt:new Date().toISOString(),browser:engine,root,url,sourceHashes:{},checks:[],scenarios:[],limitations:['Semantic and keyboard checks are not a direct VoiceOver/TalkBack audit.','External signup submissions are intentionally never sent.']};
for(const f of ['index.html','site-behavior.js','site-accessibility.css','site-polish.css','site-gallery.js','site-legal.css'])try{report.sourceHashes[f]=createHash('sha256').update(await readFile(path.join(root,f))).digest('hex');}catch{}
const browser=await playwright[engine].launch({headless:true});
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function check(scenario,name,fn){try{report.checks.push({scenario,name,pass:true,evidence:await fn()});}catch(e){report.checks.push({scenario,name,pass:false,error:String(e.message).slice(0,2400)});}}
async function interactions(page,label,width) {
  if(width<800)await check(label,'Mobile menu: keyboard open, Escape close, anchor clearance',async()=>{
    const t=page.locator('#navToggle');
    assert.equal(await t.getAttribute('aria-controls'),'navLinks');
    await t.focus();await page.keyboard.press('Enter');
    assert.equal(await t.getAttribute('aria-expanded'),'true');
    assert(await page.locator('#navLinks').isVisible());
    await page.keyboard.press('Escape');
    assert.equal(await t.getAttribute('aria-expanded'),'false');
    assert(await t.evaluate(e=>document.activeElement===e),'Escape restores menu focus');
    await page.keyboard.press('Space');
    assert.equal(await t.getAttribute('aria-expanded'),'true');
    await page.locator('#navLinks a[href="#faq"]').focus();await page.keyboard.press('Enter');
    assert.equal(await t.getAttribute('aria-expanded'),'false');
    await page.waitForFunction(()=>Math.abs(document.querySelector('#faq').getBoundingClientRect().top)<200);
    const pos=await page.evaluate(()=>({top:document.querySelector('#faq').getBoundingClientRect().top,bottom:document.querySelector('.navbar').getBoundingClientRect().bottom}));
    assert(pos.top>=pos.bottom-1,'anchor hidden under header: '+JSON.stringify(pos));return pos;
  });
  await check(label,'FAQ: keyboard, answer visibility and exclusive expanded state',async()=>{
    const a=page.locator('.faq-q').nth(0),b=page.locator('.faq-q').nth(1);
    const id=await a.getAttribute('aria-controls');assert(id);
    assert.equal(await a.getAttribute('aria-expanded'),'false');
    await a.focus();await page.keyboard.press('Enter');
    assert.equal(await a.getAttribute('aria-expanded'),'true');assert(await page.locator('#'+id).isVisible());
    await b.focus();await page.keyboard.press('Space');
    assert.equal(await b.getAttribute('aria-expanded'),'true');assert.equal(await a.getAttribute('aria-expanded'),'false');
    assert.equal(await page.locator('#'+id).isVisible(),false);
    await page.keyboard.press('Space');assert.equal(await b.getAttribute('aria-expanded'),'false');
    return {answerId:id,count:await page.locator('.faq-q').count()};
  });
  await check(label,'Pricing: keyboard changes actual annual/monthly totals and pressed state',async()=>{
    const m=page.locator('#toggleMonthly'),y=page.locator('#toggleYearly');
    await y.focus();await page.keyboard.press('Enter');
    assert.equal(await y.getAttribute('aria-pressed'),'true');assert.equal(await m.getAttribute('aria-pressed'),'false');
    assert.deepEqual(await page.locator('.price-card .price-amount').allTextContents(),['$0','$59.99','$179.99']);
    assert.deepEqual(await page.locator('.price-card .price-period').allTextContents(),['forever','/year','/year']);
    await m.focus();await page.keyboard.press('Space');
    assert.equal(await m.getAttribute('aria-pressed'),'true');assert.equal(await y.getAttribute('aria-pressed'),'false');
    assert.deepEqual(await page.locator('.price-card .price-amount').allTextContents(),['$0','$9.99','$19.99']);
    assert.deepEqual(await page.locator('.price-card .price-period').allTextContents(),['forever','/month','/month']);
  });
  await check(label,'Gallery: three distinct frames, keyboard selection, one active slide',async()=>{
    const controls=page.locator('.hero-view-controls button[data-slide]');assert.equal(await controls.count(),3);
    const seen=[];
    for(let i=0;i<3;i++){
      const b=controls.nth(i);assert((await b.innerText()).trim().length);
      await b.focus();await page.keyboard.press('Enter');await pause(500);
      assert.equal(await b.getAttribute('aria-pressed'),'true');
      assert.equal(await page.locator('.hero-view-controls button[aria-pressed="true"]').count(),1);
      const visible=await page.locator('.hero-slide').evaluateAll(es=>es.filter(e=>{const s=getComputedStyle(e);return s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity)>.95&&e.getBoundingClientRect().width>0;}).map(e=>({src:e.getAttribute('src'),alt:e.alt,hidden:e.getAttribute('aria-hidden')})));
      assert.equal(visible.length,1,JSON.stringify(visible));assert(visible[0].alt.length>10);
      assert.equal(visible[0].hidden,'false');seen.push(visible[0].src);
    }
    assert.equal(new Set(seen).size,3);await pause(1600);
    assert.equal(await controls.last().getAttribute('aria-pressed'),'true','must not auto-rotate');
    await controls.first().focus();await page.keyboard.press('Space');return seen;
  });

  await check(label,'Screenshot enlargement: Enter and click open dialog; Escape/close restore focus',async()=>{
    const images=page.locator('.phone-card .phone-front');
    assert(await images.count()>=3);
    const trigger=images.first(),dialog=page.locator('.screen-dialog');
    assert.equal(await trigger.getAttribute('role'),'button');
    assert.equal(await trigger.getAttribute('aria-haspopup'),'dialog');
    await trigger.focus();await page.keyboard.press('Enter');
    assert(await dialog.isVisible());assert.equal(await dialog.getAttribute('open'),'');
    const src=await trigger.getAttribute('src');
    assert.equal(await dialog.locator('img').getAttribute('src'),await trigger.evaluate(e=>e.currentSrc||e.src));
    assert.equal(await dialog.locator('img').getAttribute('alt'),await trigger.getAttribute('alt'));
    await page.keyboard.press('Escape');
    assert.equal(await dialog.isVisible(),false);assert(await trigger.evaluate(e=>document.activeElement===e));
    const second=images.nth(1);await second.click();assert(await dialog.isVisible());
    await dialog.getByRole('button',{name:'Close screenshot'}).click();
    assert.equal(await dialog.isVisible(),false);assert(await second.evaluate(e=>document.activeElement===e));
    return {source:src};
  });

}
async function scenario({label,width,height=900,js=true,blocked=false,motion='no-preference',large=false}){
  const context=await browser.newContext({viewport:{width,height},javaScriptEnabled:js,reducedMotion:motion,colorScheme:'dark',locale:'en-US'});
  const page=await context.newPage();page.setDefaultTimeout(5000);
  const errors=[],consoleErrors=[],localFailures=[],blockedResources=[],preventedPosts=[];
  page.on('pageerror',e=>errors.push(String(e)));
  page.on('console',msg=>{
    if(msg.type()!=='error')return;
    const source=msg.location().url||'',text=msg.text();
    if(blocked&&source&&new URL(source,url).origin!==origin&&/net::ERR_FAILED|Failed to load resource|Load failed/i.test(text))return;
    if(preventedPosts.includes(source)&&/net::ERR_FAILED|Failed to load resource|Load failed/i.test(text))return;
    consoleErrors.push({text,source});
  });
  page.on('response',r=>{if(new URL(r.url()).origin===origin&&r.status()>=400)localFailures.push({url:r.url(),status:r.status()});});
  await page.route('**/*',async r=>{
    const q=r.request(),external=new URL(q.url()).origin!==origin;
    if(external&&!['GET','HEAD'].includes(q.method())){preventedPosts.push(q.url());await r.abort();return;}
    if(external&&blocked){blockedResources.push(q.url());await r.abort();return;}
    await r.continue();
  });
  try{
    await check(label,'Page responds and headline renders',async()=>{
      const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:30000});assert.equal(response.status(),200);
      assert.match(await page.title(),/CryptoSage/);await page.locator('h1').waitFor({state:'visible'});return await page.title();
    });
    if(large)await page.addStyleTag({content:'html {font-size:200% !important;}'});
    await check(label,'All product images decode and have alt attributes',async()=>{
      const imgs=await page.evaluate(async()=>{const imgs=[...document.images].filter(e=>e.hasAttribute('src')||e.hasAttribute('srcset'));imgs.forEach(e=>e.loading='eager');return await Promise.all(imgs.map(async e=>{try{await e.decode();}catch{}return {src:e.getAttribute('src'),w:e.naturalWidth,h:e.naturalHeight,alt:e.getAttribute('alt')};}));});
      assert(imgs.length>=5);assert.deepEqual(imgs.filter(e=>!e.w||!e.h),[]);assert.deepEqual(imgs.filter(e=>e.alt===null),[]);return {decoded:imgs.length};
    });
    if(js)await page.evaluate(async()=>{for(let y=0;y<document.documentElement.scrollHeight;y+=Math.max(innerHeight*.8,600)){window.scrollTo(0,y);await new Promise(r=>setTimeout(r,35));}window.scrollTo(0,0);});await pause(1000);
    await check(label,'Responsive layout has no horizontal overflow or clipped headings/actions',async()=>{
      const result=await page.evaluate(()=>{const width=document.documentElement.clientWidth;return {width,scrollWidth:document.documentElement.scrollWidth,escaped:[...document.querySelectorAll('h1,h2,h3,.hero-text,.hero-kicker,.hero .subtitle,.platform-badge,.hero-buttons,.price-card,.faq-q,.hero-view-controls')].filter(e=>{const r=e.getBoundingClientRect();return r.width&&getComputedStyle(e).display!=='none'&&(r.left < -1||r.right>width+1);}).map(e=>({tag:e.tagName,class:e.className,text:e.textContent.trim().slice(0,60),left:e.getBoundingClientRect().left,right:e.getBoundingClientRect().right}))};});
      assert(result.scrollWidth<=result.width+1,JSON.stringify(result));assert.deepEqual(result.escaped,[]);return result;
    });
    await check(label,'Scroll-reveal content stays readable after full-page traversal',async()=>{
      const hidden=await page.locator('.anim').evaluateAll(es=>es.filter(e=>{const s=getComputedStyle(e);return Number(s.opacity)<.9||s.visibility==='hidden';}).map(e=>e.textContent.trim().slice(0,80)));
      assert.deepEqual(hidden,[]);return {visible:await page.locator('.anim').count()};
    });
    if(js)await interactions(page,label,width);
    else{
      await check(label,'No-JS FAQ answers, monthly pricing and download CTA are usable',async()=>{
        const hidden=await page.locator('.faq-a').evaluateAll(es=>es.filter(e=>{const s=getComputedStyle(e);return s.display==='none'||s.visibility==='hidden'||Number(s.opacity)<.9||e.getBoundingClientRect().height<20;}).length);
        assert.equal(hidden,0);assert.deepEqual(await page.locator('.price-card .price-amount').allTextContents(),['$0','$9.99','$19.99']);
        assert(await page.locator('.hero-buttons a[href*="apps.apple.com"]').first().isVisible());
      });
      await check(label,'No-JS mobile navigation links still reach sections',async()=>{
        const a=page.locator('#navLinks a[href="#faq"]');assert(await a.isVisible());await a.focus();await page.keyboard.press('Enter');
        await page.waitForFunction(()=>location.hash==='#faq');return await page.evaluate(()=>location.hash);
      });
    }

    if(blocked&&js)await check(label,'Newsletter outage: visible retry status, recovered button, no submission',async()=>{
      const form=page.locator('.signup-form'),email=page.locator('#signupEmail'),button=form.locator('button[type="submit"]');
      await email.fill('website-qa@example.invalid');await button.click();
      await page.waitForFunction(()=>document.querySelector('#signupStatus')?.textContent.includes('couldn’t save'),{},{timeout:15000});
      assert.equal(await button.isDisabled(),false);assert.equal(await form.getAttribute('aria-busy'),null);
      assert.equal(await page.locator('#signupStatus').getAttribute('aria-live'),'polite');
      assert(blockedResources.some(u=>u.includes('firebase-app-compat')),'Firebase script must be blocked before any email write');
      assert(!preventedPosts.some(u=>/firestore|firebase/i.test(u)),'no database submission was attempted');
      return {status:await page.locator('#signupStatus').innerText(),blockedFirebase:true};
    });

    if(motion==='reduce')await check(label,'Reduced motion stops ongoing decorative animations',async()=>{
      await page.evaluate(()=>window.scrollTo(0,0));await pause(500);
      const active=await page.evaluate(()=>document.getAnimations({subtree:true}).filter(a=>a.playState==='running'&&a.effect.getTiming().duration>10).map(a=>({name:a.animationName||a.transitionProperty,duration:a.effect.getTiming().duration})));
      assert.deepEqual(active,[]);return {running:active.length};
    });
    await check(label,'Every download CTA targets the intended store product safely',async()=>{
      const links=await page.locator('a[href*="apps.apple.com"]').evaluateAll(es=>es.map(e=>({href:e.href,target:e.target,rel:e.rel})));assert(links.length>=3);
      for(const a of links){assert.match(a.href,/\/id6792761331(?:$|[/?#])/);if(a.target==='_blank')assert.match(a.rel,/noopener/);}return {count:links.length};
    });
    await page.evaluate(()=>window.scrollTo(0,0));await pause(200);
    await page.screenshot({path:path.join(out,label+'-hero.png')});
    await page.screenshot({path:path.join(out,label+'-full.png'),fullPage:true});
    if(js){await page.locator('#pricing').scrollIntoViewIfNeeded();await page.locator('#pricing').screenshot({path:path.join(out,label+'-pricing.png'),style:'.navbar,.scroll-top{visibility:hidden!important}'});}
    await check(label,'No uncaught exceptions, unexpected console errors or local HTTP failures',async()=>{
      assert.deepEqual(errors,[]);assert.deepEqual(consoleErrors,[]);assert.deepEqual(localFailures,[]);return {exceptions:0,consoleErrors:0,localFailures:0};
    });
  }catch(e){report.checks.push({scenario:label,name:"Scenario completed",pass:false,error:String(e.message)});}finally{report.scenarios.push({label,width,height,js,blocked,motion,large,errors,consoleErrors,localFailures,blockedResources,preventedPosts});await context.close();await writeFile(path.join(out,"progress.json"),JSON.stringify(report,null,2));console.log(label+": "+report.checks.filter(c=>c.scenario===label&&c.pass).length+" passed, "+report.checks.filter(c=>c.scenario===label&&!c.pass).length+" failed");}
}

async function secondaryPages(){
  for(const width of [375,1440])for(const name of ['support.html','privacy-policy.html','terms.html','404.html']){
    const label='no-js-'+width+'-'+name.replace('.html','');
    const context=await browser.newContext({viewport:{width,height:844},javaScriptEnabled:false,reducedMotion:'reduce'});
    const page=await context.newPage();page.setDefaultTimeout(5000);
    await page.route('**/*',r=>new URL(r.request().url()).origin!==origin?r.abort():r.continue());
    try{
      await check(label,'Page renders without JavaScript without horizontal overflow',async()=>{
        const response=await page.goto(new URL(name,url).href,{waitUntil:'domcontentloaded',timeout:15000});
        assert.equal(response.status(),200);assert(await page.locator('h1').isVisible());
        const size=await page.evaluate(()=>({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
        assert(size.scroll<=size.width+1,JSON.stringify(size));
        const broken=await page.locator('img[src]').evaluateAll(es=>es.filter(e=>e.complete&&!e.naturalWidth).map(e=>e.src));
        assert.deepEqual(broken,[]);return {headline:await page.locator('h1').innerText(),...size};
      });
      await page.screenshot({path:path.join(out,label+'.png'),fullPage:true});
      await check(label,'Keyboard navigation reaches home without scripts',async()=>{
        const links=page.locator('a[href="index.html"],a[href="./"],a[href="/"],a[href="index.html#features"]');
        assert(await links.count()>0);
        let link;
        for(let i=0;i<await links.count();i++)if(await links.nth(i).isVisible()){link=links.nth(i);break;}
        assert(link,'a visible home navigation link is required');
        await link.focus();
        await Promise.all([page.waitForURL(u=>u.pathname==='/'||u.pathname.endsWith('/index.html')),page.keyboard.press('Enter')]);
        assert.match(await page.locator('h1').innerText(),/portfolio/i);
        return {destination:page.url()};
      });
    }finally{await context.close();}
  }
}

try{
  for(const width of [375,390,768,1440])await scenario({label:'responsive-'+width,width});
  await scenario({label:'reduced-motion',width:390,motion:'reduce'});
  await scenario({label:'no-javascript',width:390,js:false,blocked:true});
  await scenario({label:'blocked-third-party',width:390,blocked:true});
  await scenario({label:'text-200-percent',width:390,motion:'reduce',large:true});
  await secondaryPages();
}finally{
  await browser.close();if(server)await new Promise(r=>server.close(r));
  report.finishedAt=new Date().toISOString();report.passed=report.checks.filter(c=>c.pass).length;report.failed=report.checks.filter(c=>!c.pass).length;
  await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
}
console.log(JSON.stringify({browser:engine,passed:report.passed,failed:report.failed,report:path.join(out,'report.json'),failures:report.checks.filter(c=>!c.pass)},null,2));
process.exitCode=report.failed?1:0;
