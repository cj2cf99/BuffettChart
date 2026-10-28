import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {freshness,addCalendarMonths} from '../src/freshness.js';
import {computeModel} from '../scripts/model.mjs';
import {handleBuffett} from '../deploy/cloudflare/routes.js';
const root=new URL('../',import.meta.url);
const read=p=>fs.readFileSync(new URL(p,root));
const input=JSON.parse(read('data/Buffett_Quarterly_Frozen_v1.json'));
test('five-month threshold uses Shanghai calendar date, strictly exceeds and clamps month end',()=>{
  assert.equal(addCalendarMonths('2026-10-07',5),'2027-03-07');
  assert.equal(freshness('2026-10-07',new Date('2027-03-07T15:59:59Z')).stale,false);
  assert.equal(freshness('2026-10-07',new Date('2027-03-07T16:00:00Z')).stale,true);
  assert.equal(freshness('2026-10-07',new Date('2026-10-28T00:00:00Z')).stale,false);
  assert.equal(addCalendarMonths('2026-09-30',5),'2027-02-28');
  assert.equal(addCalendarMonths('2027-09-30',5),'2028-02-29');
  assert.throws(()=>addCalendarMonths('2026-02-30',5));
});
test('frozen input, model parameters and all 298 derived points preserve the original contract',()=>{
  assert.equal(createHash('sha256').update(read('data/Buffett_Quarterly_Frozen_v1.json')).digest('hex'),'811a45df3978d0e4e41d85012a737683014f5eba579ba5584a92536e2af68b1a');
  const before=JSON.stringify(input),m=computeModel(input),last=m.rows.at(-1);
  assert.equal(JSON.stringify(input),before);
  assert.equal(m.n,298);
  for(const [key,value] of Object.entries({a:3.7517877600036833,b_per_year:0.016375401068659763,sigma_log:0.3385719898464284}))assert.ok(Math.abs(m[key]-value)<1e-12);
  assert.ok(Math.abs(last.bi_pct-238.42581602510577)<1e-10);
  assert.ok(Math.abs(last.deviation_pct-65.9301828526435)<1e-10);
  assert.ok(Math.abs(last.z_score-1.4956846515931057)<1e-12);
  assert.equal(m.rows.filter(r=>r.historical_estimate).length,179);
  let sum=0,orthogonal=0;
  for(const [i,r] of m.rows.entries()){
    const residual=Math.log(r.bi_pct/r.trend_pct);sum+=residual;orthogonal+=residual*i/4;
    assert.ok(Math.abs((r.deviation_pct/100+1)*r.trend_pct-r.bi_pct)<1e-10);
  }
  assert.ok(Math.abs(sum)<1e-10);assert.ok(Math.abs(orthogonal)<1e-8);
  const bad=structuredClone(input);bad.rows[5].period=bad.rows[4].period;
  assert.throws(()=>computeModel(bad),/Non-contiguous/);
});
test('build is deterministic, exposes only two charts and never resets data freshness',()=>{
  execFileSync(process.execPath,[new URL('../scripts/build.mjs',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1')],{cwd:root,stdio:'pipe'});
  const first=read('publication.json');
  execFileSync(process.execPath,[new URL('../scripts/build.mjs',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1')],{cwd:root,stdio:'pipe'});
  assert.deepEqual(read('publication.json'),first);
  const html=read('dist/index.html').toString(),snapshot=JSON.parse(read('dist/snapshot.json'));
  assert.equal((html.match(/<svg /g)||[]).length,2);
  assert.ok(!html.includes('{{'));assert.match(html,/238\.43/);assert.match(html,/\+65\.93/);
  assert.match(html,/data-updated-on="2026-10-07"/);
  assert.equal(snapshot.updated_on,'2026-10-07');assert.equal(snapshot.data_through,'2026Q2');
  for(const f of JSON.parse(first).files)assert.equal(createHash('sha256').update(read('dist/'+f.name)).digest('hex'),f.sha256);
});
test('subpage routing is read-only, isolated, canonicalized and excludes source/archive',async()=>{
  const env={STOCKCHECK_ASSETS:{fetch:async request=>new Response(new URL(request.url).pathname,{headers:{'Content-Type':'text/html'}})}};
  const req=(p,method='GET')=>new Request('https://example.test'+p,{method});
  for(const p of ['/','/buffettest/','/stockcheck/'])assert.equal(await handleBuffett(req(p),env),null);
  const redirect=await handleBuffett(req('/buffett?x=1'),env);
  assert.equal(redirect.status,301);assert.equal(redirect.headers.get('Location'),'https://example.test/buffett/?x=1');
  for(const p of ['archive/test.zip','data/manifest.json','.git/config','not-found','%2e%2e%2fprivate'])assert.equal((await handleBuffett(req('/buffett/'+p),env)).status,404);
  for(const method of ['POST','PUT','PATCH','DELETE'])assert.equal((await handleBuffett(req('/buffett/',method),env)).status,405);
  let res=await handleBuffett(req('/buffett/'),env);
  assert.equal(await res.text(),'/buffett/index.html');assert.match(res.headers.get('Cache-Control'),/^private/);
  assert.match(res.headers.get('Content-Security-Policy'),/script-src 'self'/);
  res=await handleBuffett(req('/buffett/','HEAD'),env);assert.equal(await res.text(),'');
  assert.equal((await handleBuffett(req('/buffett/'),{})).status,503);
});
test('browser status actually changes at expiry and on timer/visibility checks',async()=>{
  const originalDate=globalThis.Date,originalDocument=globalThis.document,originalInterval=globalThis.setInterval;
  let date='2027-03-07T15:59:59Z',timer,visible;
  const classes=new Set(),nodes={
    '[data-updated-on]':{dataset:{updatedOn:'2026-10-07'},classList:{toggle:(k,on)=>on?classes.add(k):classes.delete(k),add:k=>classes.add(k)}},
    '#status-title':{},'#status-detail':{},'#status-label':{},
  };
  try{
    globalThis.Date=class extends originalDate{constructor(...args){super(...(args.length?args:[date]));}};
    globalThis.document={hidden:false,querySelector:s=>nodes[s],addEventListener:(event,fn)=>{if(event==='visibilitychange')visible=fn;}};
    globalThis.setInterval=(fn,ms)=>{assert.equal(ms,60000);timer=fn;};
    await import('../src/app.js?browser-test');
    assert.equal(classes.has('stale'),false);
    date='2027-03-07T16:00:00Z';timer();
    assert.equal(classes.has('stale'),true);assert.equal(nodes['#status-label'].textContent,'需要更新');
    assert.match(nodes['#status-title'].textContent,/超过 5 个月/);
    date='2027-03-06T00:00:00Z';visible();assert.equal(classes.has('stale'),false);
  }finally{globalThis.Date=originalDate;globalThis.document=originalDocument;globalThis.setInterval=originalInterval;}
});
