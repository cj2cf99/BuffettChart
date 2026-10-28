import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadSP500,monthlyModel,updateSP500} from '../scripts/sp500.mjs';
import {build} from '../scripts/build.mjs';
import {fetchSP500,renderSP500Chart} from '../src/sp500.js';
const root=fileURLToPath(new URL('../',import.meta.url));
test('SP500 original 835 monthly averages independently reproduce the handed-off model',()=>{
  const s=loadSP500(root),m=monthlyModel(s.baseline),last=m.rows.at(-1);
  assert.equal(m.n,835);assert.equal(last.price,7691.1);
  for(const[k,v]of Object.entries({a:3.547017709523559,b_per_year:0.07137635604760299,sigma_log:0.28525583797630233}))assert.ok(Math.abs(m[k]-v)<1e-12);
  assert.ok(Math.abs(last.trend_price-4952.632115936163)<1e-8);assert.ok(Math.abs(last.deviation_pct-55.29318188710668)<1e-10);
  assert.ok(Math.abs(last.z_score-1.5429820594504366)<1e-12);
  const reference=fs.readFileSync(path.join(root,'archive/sp500-reference-calculations.csv'),'utf8').trim().split(/\r?\n/).slice(1);
  assert.equal(reference.length,835);reference.forEach((line,i)=>{const[p,price,trend,deviation,z]=line.split(',');const row=m.rows[i];assert.equal(row.period,p);for(const[a,b]of [[row.price,Number(price)],[row.trend_price,Number(trend)],[row.deviation_pct,Number(deviation)],[row.z_score,Number(z)]])assert.ok(Math.abs(a-b)<1e-8);});
});
test('monthly browser data and charts keep points distinct from percentage deviation',async()=>{
  const {current,model}=await fetchSP500(new URL('https://example.test/buffett/'),async url=>new Response(fs.readFileSync(path.join(root,'dist',url.pathname.slice('/buffett/'.length)))));
  const raw=renderSP500Chart(model,current,false),detrended=renderSP500Chart(model,current,true);
  assert.match(raw,/标普 500 长期价格/);assert.match(raw,/7691\.10/);assert.ok(!raw.includes('7691.10%'));assert.ok(!raw.includes('冻结历史估计'));
  assert.match(detrended,/55\.29%/);assert.match(raw,/sp500-h-title/);
  const doc=fs.readFileSync(path.join(root,'dist/index.html'),'utf8');assert.match(doc,/<title>长期指标/);assert.match(doc,/id="nikkei225"/);assert.match(doc,/当前没有日经数据/);
});
test('monthly revisions need acceptance, preserve fixed prices and only change monthly update assets',()=>{
  const dir=fs.mkdtempSync(path.join(root,'work/sp500-test-'));for(const name of ['data','src'])fs.cpSync(path.join(root,name),path.join(dir,name),{recursive:true});
  build(dir);const s=loadSP500(dir),row={...s.rows.at(-1),price:s.rows.at(-1).price+1};
  const c={snapshot_id:'synthetic_sp500_revision',updated_on:'2026-10-28',source_note:'Synthetic test only',revision_reason:'Test',rows:[row]};
  assert.equal(updateSP500(dir,c).requires_acceptance,true);assert.throws(()=>updateSP500(dir,c,{apply:true}),/acceptance/);
  updateSP500(dir,c,{apply:true,acceptRevisions:true});assert.deepEqual(build(dir).written.sort(),['sp500/updates/current.json','sp500/updates/recent.json']);
  assert.throws(()=>updateSP500(dir,{...c,snapshot_id:'bad_fixed',rows:[{...s.fixed.at(-1),price:10}]},{apply:true,acceptRevisions:true}),/Fixed/);
  const next={period:'2026-10',price:7700};assert.throws(()=>updateSP500(dir,{...c,snapshot_id:'partial_month',rows:[next]},{apply:true}),/complete monthly/);
  updateSP500(dir,{...c,updated_on:'2026-11-07',snapshot_id:'synthetic_sp500_append',rows:[next]},{apply:true});
  const result=build(dir);assert.equal(result.written.filter(f=>f.includes('/fixed/')).length,1);assert.equal(loadSP500(dir).active.rows.length,24);
  assert.deepEqual(build(dir).written,[]);
});
