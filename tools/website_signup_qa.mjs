#!/usr/bin/env node
// Focused pending-newsletter regression. Uses only an injected local Firebase mock;
// every non-loopback network request is denied before navigation.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const require=createRequire(import.meta.url);
const {chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const args=process.argv.slice(2),option=(n,d)=>args.includes(n)?args[args.indexOf(n)+1]:d;
const base=option('--url','http://127.0.0.1:8769/'),origin=new URL(base).origin;
assert(['127.0.0.1','localhost'].includes(new URL(base).hostname),'This mock test may only target a loopback site.');
const engine=option('--browser','chromium'),out=option('--out','/tmp/cryptosage-web-review-20261030/focused-signup-'+engine);
await mkdir(out,{recursive:true});
const browser=await ({chromium,webkit}[engine]).launch({headless:true});
const context=await browser.newContext({viewport:{width:390,height:900},reducedMotion:'reduce'});
const denied=[],networkWrites=[],errors=[],checks=[];
await context.route(u=>u.origin!==origin,async route=>{denied.push(route.request().url());await route.abort();});
await context.addInitScript(()=>{
  window.__qaSignupCalls=[];
  window.firebase={
    apps:[{}],firestore(){},
    app(){return {firestore(){return {
      collection(name){
        if(name!=='early_access')throw new Error('Unexpected collection');
        return {add(value){
          window.__qaSignupCalls.push(value);
          return new Promise((resolve,reject)=>{window.__qaResolve=resolve;window.__qaReject=reject;});
        }};
      }
    };}};}
  };
});
const page=await context.newPage();
page.on('request',r=>{if(!['GET','HEAD'].includes(r.method())&&new URL(r.url()).origin!==origin)networkWrites.push(r.url());});
page.on('pageerror',e=>errors.push(String(e)));
const check=async(name,fn)=>{try{checks.push({name,pass:true,evidence:await fn()});}catch(e){checks.push({name,pass:false,error:String(e.message)});}};
try{
  await page.goto(base,{waitUntil:'domcontentloaded'});
  const form=page.locator('.signup-form'),email=page.locator('#signupEmail'),button=form.locator('button[type="submit"]'),status=page.locator('#signupStatus');
  await check('Pending write gets honest feedback after 15 seconds and prevents duplicate submission',async()=>{
    await email.fill('website-qa@example.invalid');await button.click();
    assert(await button.isDisabled());assert.equal(await form.getAttribute('aria-busy'),'true');
    await page.waitForFunction(()=>document.querySelector('#signupStatus').textContent.includes('awaiting confirmation'),{},{timeout:18000});
    assert(await button.isDisabled());assert.equal(await button.innerText(),'Awaiting confirmation…');
    assert.match(await status.innerText(),/avoid submitting again/);
    await email.focus();await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(()=>window.__qaSignupCalls.length),1);
    await form.screenshot({path:path.join(out,'awaiting-confirmation.png'),style:'.navbar,.scroll-top{visibility:hidden!important}'});
    return {status:await status.innerText(),localMockCalls:1};
  });
  await check('Eventual confirmed success recovers the form',async()=>{
    await page.evaluate(()=>window.__qaResolve({id:'local-mock-only'}));
    await page.waitForFunction(()=>document.querySelector('#signupStatus').textContent.includes('subscribed'));
    assert.equal(await button.isDisabled(),false);assert.equal(await form.getAttribute('aria-busy'),null);assert.equal(await email.inputValue(),'');
    return await status.innerText();
  });
  await check('Confirmed failure reports retry state and recovers the form',async()=>{
    await email.fill('website-qa-failure@example.invalid');await button.click();
    await page.waitForFunction(()=>window.__qaSignupCalls.length===2);
    await page.evaluate(()=>window.__qaReject(new Error('Local mock rejects: no remote database call')));
    await page.waitForFunction(()=>document.querySelector('#signupStatus').textContent.includes('couldn’t save'));
    assert.equal(await button.isDisabled(),false);assert.equal(await form.getAttribute('aria-busy'),null);
    return await status.innerText();
  });
  await check('Latest controls meet 44px targets and enlarged hero still reflows',async()=>{
    const small=await page.locator('.hero-view-controls button,.toggle-btn,#navToggle').evaluateAll(es=>es.filter(e=>e.getBoundingClientRect().height<44).map(e=>({text:e.textContent.trim(),height:e.getBoundingClientRect().height})));
    assert.deepEqual(small,[]);
    await page.addStyleTag({content:'html{font-size:200%!important}'});
    const escaped=await page.locator('.hero-text,.hero h1,.hero .subtitle,.hero-eyebrow').evaluateAll(es=>es.filter(e=>{const r=e.getBoundingClientRect();return r.left < -1||r.right>innerWidth+1;}).map(e=>e.className));
    assert.deepEqual(escaped,[]);
    await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:path.join(out,'large-text-hero.png')});
  });
  await check('The test made no external writes or uncaught errors',async()=>{
    assert.deepEqual(networkWrites,[]);assert.deepEqual(errors,[]);
    assert(!denied.some(u=>u.includes('firestore')),'Firebase calls must remain local mock calls');
    return {externalWrites:0,uncaughtErrors:0,deniedExternalRequests:denied.length};
  });
}finally{
  await browser.close();
  const sourceHashes={};
  const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
  for(const f of ['index.html','site-behavior.js','site-accessibility.css','site-polish.css','site-gallery.js','site-legal.css','fonts.css'])sourceHashes[f]=createHash('sha256').update(await readFile(path.join(root,f))).digest('hex');
  const result={browser:engine,completedAt:new Date().toISOString(),url:base,sourceHashes,checks,deniedExternalRequests:denied,externalWrites:networkWrites,passed:checks.filter(c=>c.pass).length,failed:checks.filter(c=>!c.pass).length};
  await writeFile(path.join(out,'report.json'),JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify(result,null,2));process.exitCode=result.failed?1:0;
}

