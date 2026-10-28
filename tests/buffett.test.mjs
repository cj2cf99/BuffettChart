import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {freshness,addCalendarMonths} from '../src/freshness.js';
import {assemble,fetchSnapshot} from '../src/series.js';
import {renderChart} from '../src/chart.js';
import {loadSource,BASELINE_HASH} from '../scripts/source.mjs';
import {computeModel} from '../scripts/model.mjs';
import {build} from '../scripts/build.mjs';
import {planUpdate,applyUpdate} from '../scripts/update-data.mjs';
import {packageUpdate} from '../scripts/package-update.mjs';
import {sha256,jsonBytes} from '../scripts/io.mjs';
import {handleBuffett} from '../deploy/cloudflare/routes.js';
const root=fileURLToPath(new URL('../',import.meta.url));
const read=(rel,dir=root)=>fs.readFileSync(path.join(dir,rel));
const json=(rel,dir=root)=>JSON.parse(read(rel,dir));
build(root);
const baseline=json('data/fixed/baseline-v1.json');
const seed=fixture(),state=loadSource(seed);
function fixture(){
  const parent=path.join(root,'work/tests');fs.mkdirSync(parent,{recursive:true});
  const dir=fs.mkdtempSync(path.join(parent,'case-'));
  for(const name of ['data','src'])fs.cpSync(path.join(root,name),path.join(dir,name),{recursive:true});
  // Seed the immutable v1 case explicitly so these regression tests continue
  // to work after the actual project adopts newer quarters or revisions.
  const active={snapshot_id:baseline.snapshot_id,updated_on:baseline.captured_on,data_through:baseline.data_through,source_note:'Seeded immutable v1 test fixture',revision_reason:null,rows:baseline.rows.slice(-8)};
  const bytes=jsonBytes(active),file='updates/snapshots/'+active.snapshot_id+'.json';
  fs.writeFileSync(path.join(dir,'data',file),bytes);
  fs.writeFileSync(path.join(dir,'data/updates/current.json'),jsonBytes({schema_version:2,recent_window:8,base_through:'2024Q2',fixed_extensions:[],active:{file,sha256:sha256(bytes)}}));
  build(dir);return dir;
}
function revised(row){
  const next=structuredClone(row);
  next.market_cap_usd_million=String(Number(next.market_cap_usd_million)+1000);
  next.source_values.BOGZ1LM883164115Q=String(Number(next.source_values.BOGZ1LM883164115Q)+1000);
  next.buffett_indicator_pct=String(Number(next.market_cap_usd_million)/1000/Number(next.gdp_usd_billion_saar)*100);
  return next;
}
function candidate(rows,id='synthetic_test_revision'){
  return {snapshot_id:id,updated_on:'2026-10-28',source_note:'SYNTHETIC TEST ONLY — never published',revision_reason:'Synthetic correction for validation only',rows};
}
function decoded(dir=seed){
  const c=json('dist/updates/current.json',dir);
  return {current:c,model:assemble(c,c.fixed.map(f=>json('dist/'+f.url,dir)),json('dist/'+c.recent.url,dir))};
}
function report(name,value){
  const file=path.join(root,'work/incremental-test-report.json');
  const prior=fs.existsSync(file)?JSON.parse(fs.readFileSync(file)):{};
  fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify({...prior,[name]:value},null,2)+'\n');
}
test('five-month threshold uses Shanghai calendar, strict expiry and month-end clamping',()=>{
  assert.equal(addCalendarMonths('2026-10-07',5),'2027-03-07');
  assert.equal(freshness('2026-10-07',new Date('2027-03-07T15:59:59Z')).stale,false);
  assert.equal(freshness('2026-10-07',new Date('2027-03-07T16:00:00Z')).stale,true);
  assert.equal(addCalendarMonths('2026-09-30',5),'2027-02-28');
  assert.equal(addCalendarMonths('2027-09-30',5),'2028-02-29');
  assert.throws(()=>addCalendarMonths('2026-02-30',5));
});
test('partition exactly preserves all baseline rows and original shared model',()=>{
  assert.equal(sha256(read('data/fixed/baseline-v1.json')),BASELINE_HASH);
  assert.deepEqual(state.input.rows,baseline.rows);
  assert.equal(state.fixedRows.length,290);assert.equal(state.active.rows.length,8);
  assert.equal(state.active.rows[0].period,'2024Q3');assert.equal(state.fixedRows.at(-1).period,'2024Q2');
  const before=JSON.stringify(state.input),m=computeModel(state.input),last=m.rows.at(-1);
  assert.equal(JSON.stringify(state.input),before);
  for(const [key,value] of Object.entries({a:3.7517877600036833,b_per_year:0.016375401068659763,sigma_log:0.3385719898464284}))assert.ok(Math.abs(m[key]-value)<1e-12);
  assert.ok(Math.abs(last.bi_pct-238.42581602510577)<1e-10);
  assert.ok(Math.abs(last.deviation_pct-65.9301828526435)<1e-10);
  assert.ok(Math.abs(last.z_score-1.4956846515931057)<1e-12);
  let sum=0,orthogonal=0;
  for(const [i,r]of m.rows.entries()){
    const residual=Math.log(r.bi_pct/r.trend_pct);sum+=residual;orthogonal+=residual*i/4;
    assert.ok(Math.abs((r.deviation_pct/100+1)*r.trend_pct-r.bi_pct)<1e-10);
  }
  assert.ok(Math.abs(sum)<1e-10);assert.ok(Math.abs(orthogonal)<1e-8);
  const publicModel=decoded().model;assert.deepEqual(publicModel.rows,m.rows);
  for(const detrended of [false,true])assert.match(renderChart(publicModel,decoded().current,detrended),/<svg /);
});
test('unchanged build preserves all published bytes and mtimes; shell contains no snapshot values',()=>{
  const publication=json('publication.json'),files=[...publication.files.map(f=>'dist/'+f.name),'publication.json'];
  const before=new Map(files.map(f=>[f,{bytes:read(f),mtime:fs.statSync(path.join(root,f)).mtimeMs}]));
  const result=build(root);assert.deepEqual(result.written,[]);
  for(const [f,old]of before){assert.deepEqual(read(f),old.bytes);assert.equal(fs.statSync(path.join(root,f)).mtimeMs,old.mtime);}
  const html=read('dist/index.html').toString();assert.ok(!html.includes('{{'));assert.ok(!html.includes('238.43'));
  for(const f of publication.files)assert.equal(sha256(read('dist/'+f.name)),f.sha256);
  report('unchanged_build',{changed_files:0,changed_bytes:0});
});
test('recent revision changes only two small public files; fixed data and shell remain untouched',()=>{
  const dir=fixture(),before=json('publication.json',dir),oldCurrent=decoded(dir).current;
  const oldTimes=new Map(before.files.filter(f=>f.zone!=='updates').map(f=>[f.name,fs.statSync(path.join(dir,'dist',f.name)).mtimeMs]));
  const next=candidate([revised(state.input.rows.at(-1))]);
  assert.throws(()=>planUpdate(dir,next),/accept-revisions/);
  const preview=planUpdate(dir,next,{preview:true});assert.equal(preview.requires_revision_acceptance,true);assert.ok(preview.revision_details[0].before);
  assert.throws(()=>applyUpdate(dir,preview),/Preview cannot be applied/);
  const plan=planUpdate(dir,next,{acceptRevisions:true});assert.deepEqual(plan.revisions,['2026Q2']);
  applyUpdate(dir,plan);const result=build(dir),after=decoded(dir);
  assert.deepEqual(result.written.sort(),['updates/current.json','updates/recent.json']);
  for(const [name,mtime]of oldTimes)assert.equal(fs.statSync(path.join(dir,'dist',name)).mtimeMs,mtime);
  assert.notEqual(after.current.model.a,oldCurrent.model.a);assert.notEqual(after.model.rows[0].deviation_pct,decoded().model.rows[0].deviation_pct);
  assert.equal(after.model.rows[0].bi_pct,decoded().model.rows[0].bi_pct);
  assert.equal(loadSource(dir).active.updated_on,'2026-10-28');
  const audit=json('data/updates/audit/synthetic_test_revision.json',dir);assert.equal(audit.revisions.length,1);assert.ok(audit.revisions[0].before);
  const changed=result.publication.files.filter(f=>result.written.includes(f.name));
  assert.ok(changed.reduce((n,f)=>n+f.bytes,0)<3000);
  const packet=packageUpdate(dir,Buffer.from(JSON.stringify(before)),path.join(dir,'work/delta'));
  assert.equal(packet.files.length,2);assert.equal(packet.changed_asset_bytes,changed.reduce((n,f)=>n+f.bytes,0));
  assert.deepEqual(fs.readdirSync(path.join(dir,'work/delta/assets')),['updates']);
  report('synthetic_recent_revision',{changed_public_files:changed.map(f=>({file:f.name,bytes:f.bytes})),changed_public_bytes:changed.reduce((n,f)=>n+f.bytes,0),fixed_files_rewritten:0,shell_rewritten:false,source_written_bytes:plan.changes.reduce((n,f)=>n+f.bytes.length,0)});
});
test('new quarter promotes oldest recent quarter once and keeps an 8-quarter update window',()=>{
  const dir=fixture(),next=revised(state.input.rows.at(-1));
  Object.assign(next,{period:'2026Q3',quarter_label:'2026-07-01',period_end:'2026-09-30'});
  const plan=planUpdate(dir,candidate([next],'synthetic_test_append'));
  assert.deepEqual(plan.appended,['2026Q3']);assert.deepEqual(plan.promoted,['2024Q3']);applyUpdate(dir,plan);
  const result=build(dir),loaded=loadSource(dir);
  assert.equal(loaded.fixedRows.at(-1).period,'2024Q3');assert.equal(loaded.active.rows[0].period,'2024Q4');assert.equal(loaded.active.rows.length,8);
  assert.equal(decoded(dir).model.rows.length,299);
  assert.equal(sha256(read('data/fixed/baseline-v1.json',dir)),BASELINE_HASH);
  assert.equal(result.written.filter(f=>f.startsWith('fixed/')).length,1);assert.ok(!result.written.includes('index.html'));
  assert.throws(()=>planUpdate(dir,candidate([revised(loaded.fixedRows.at(-1))],'attempt_fixed_revision'),{acceptRevisions:true}),/Fixed history/);
  const changed=result.publication.files.filter(f=>result.written.includes(f.name));
  report('synthetic_new_quarter',{promoted:'2024Q3',recent_quarters:8,changed_public_files:changed.map(f=>({file:f.name,bytes:f.bytes})),changed_public_bytes:changed.reduce((n,f)=>n+f.bytes,0),old_fixed_files_rewritten:0,shell_rewritten:false});
});
test('invalid updates fail before writing; unchanged candidate cannot reset freshness; stale plan is refused',()=>{
  const dir=fixture(),pointer=read('data/updates/current.json',dir);
  const fixedRevision=candidate([revised(state.fixedRows.at(-1))]);assert.throws(()=>planUpdate(dir,fixedRevision,{acceptRevisions:true}),/Fixed history/);
  const gap=revised(state.input.rows.at(-1));Object.assign(gap,{period:'2026Q4',quarter_label:'2026-10-01',period_end:'2026-12-31'});
  assert.throws(()=>planUpdate(dir,candidate([gap])),/Non-contiguous/);
  const bad=revised(state.input.rows.at(-1));bad.source_values.GDP='1';assert.throws(()=>planUpdate(dir,candidate([bad]),{acceptRevisions:true}),/source values/);
  const plan=planUpdate(dir,candidate([state.input.rows.at(-1)],'unchanged'));
  assert.equal(plan.no_change,true);applyUpdate(dir,plan);assert.deepEqual(read('data/updates/current.json',dir),pointer);
  const a=planUpdate(dir,candidate([revised(state.input.rows.at(-1))],'a'),{acceptRevisions:true});
  const b=planUpdate(dir,candidate([revised(state.input.rows.at(-1))],'b'),{acceptRevisions:true});applyUpdate(dir,a);
  assert.throws(()=>applyUpdate(dir,b),/re-plan/);
  fs.appendFileSync(path.join(dir,'data/fixed/baseline-v1.json'),' ');assert.throws(()=>loadSource(dir),/baseline hash/);
});
test('browser data loader verifies hashes and retries a torn deployment without rendering mixed versions',async()=>{
  let currentReads=0,recentReads=0;
  const fetcher=async url=>{
    const rel=url.pathname.slice('/buffett/'.length);
    if(rel==='updates/current.json')currentReads++;
    if(rel==='updates/recent.json'&&recentReads++===0)return new Response('{}');
    return new Response(read('dist/'+rel,seed));
  };
  const result=await fetchSnapshot(new URL('https://example.test/buffett/'),fetcher);
  assert.equal(result.model.n,298);assert.equal(currentReads,2);
  await assert.rejects(()=>fetchSnapshot(new URL('https://example.test/buffett/'),async url=>new Response(url.pathname.endsWith('/recent.json')?'{}':read('dist/'+url.pathname.slice('/buffett/'.length),seed))),/版本不一致/);
  const current=decoded().current,invalid=structuredClone(current);invalid.fixed[0].url='https://evil.example/data';
  await assert.rejects(()=>fetchSnapshot(new URL('https://example.test/buffett/'),async()=>new Response(JSON.stringify(invalid))),/非法数据引用/);
});
test('routes isolate source data, use private immutable cache for hashed fixed assets and revalidate updates',async()=>{
  const env={STOCKCHECK_ASSETS:{fetch:async request=>new Response(new URL(request.url).pathname)}},req=(p,method='GET')=>new Request('https://test.example'+p,{method});
  for(const p of ['/','/buffettest/','/stockcheck/'])assert.equal(await handleBuffett(req(p),env),null);
  const redirect=await handleBuffett(req('/buffett?x=1'),env);assert.equal(redirect.headers.get('Location'),'https://test.example/buffett/?x=1');
  for(const p of ['archive/a.zip','data/fixed/baseline-v1.json','fixed/baseline-v1.json','updates/snapshots/a.json','fixed/app.js','.git/config','snapshot.json'])assert.equal((await handleBuffett(req('/buffett/'+p),env)).status,404);
  for(const method of ['POST','PUT','PATCH','DELETE'])assert.equal((await handleBuffett(req('/buffett/',method),env)).status,405);
  const fixed=json('publication.json').files.find(f=>f.zone==='fixed');
  let res=await handleBuffett(req('/buffett/'+fixed.name),env);assert.match(res.headers.get('Cache-Control'),/^private, max-age=31536000, immutable$/);
  for(const name of ['','updates/current.json','updates/recent.json'])assert.match((await handleBuffett(req('/buffett/'+name),env)).headers.get('Cache-Control'),/must-revalidate/);
  res=await handleBuffett(req('/buffett/','HEAD'),env);assert.equal(await res.text(),'');
  assert.equal((await handleBuffett(req('/buffett/'),{})).status,503);
});
test('actual browser module renders verified values, creates downloads and changes stale status on timer',async()=>{
  const originals={Date:globalThis.Date,document:globalThis.document,location:globalThis.location,fetch:globalThis.fetch,setInterval:globalThis.setInterval};
  let date='2027-03-07T15:59:59Z',timer,visibility;
  const nodes=new Map(),classes=new Set();
  const node=id=>{if(!nodes.has(id))nodes.set(id,{textContent:'',classList:{toggle:(k,on)=>on?classes.add(k):classes.delete(k),add:k=>classes.add(k)},setAttribute(){},removeAttribute(){},addEventListener(){}});return nodes.get(id);};
  try{
    globalThis.Date=class extends originals.Date{constructor(...args){super(...(args.length?args:[date]));}};
    globalThis.document={hidden:false,querySelector:node,addEventListener:(name,fn)=>{if(name==='visibilitychange')visibility=fn;}};
    globalThis.location={href:'https://test.example/buffett/'};
    globalThis.fetch=async url=>new Response(read('dist/'+url.pathname.slice('/buffett/'.length),seed));
    globalThis.setInterval=(fn,ms)=>{assert.equal(ms,60000);timer=fn;};
    await import('../src/app.js?isolated-dom-test');
    for(let i=0;i<100&&node('#status-label').textContent!=='季度快照';i++)await new Promise(resolve=>setImmediate(resolve));
    assert.equal(node('[data-field="bi"]').textContent,'238.43');assert.equal(node('[data-field="deviation"]').textContent,'+65.93');
    assert.match(node('#historical-chart').innerHTML,/<svg /);assert.match(node('#download-snapshot').href,/^blob:/);
    date='2027-03-07T16:00:00Z';timer();assert.equal(node('#status-label').textContent,'需要更新');
    date='2027-03-06T00:00:00Z';visibility();assert.equal(node('#status-label').textContent,'季度快照');
    for(const id of ['#download-historical','#download-detrended','#download-snapshot'])URL.revokeObjectURL(node(id).href);
  }finally{Object.assign(globalThis,originals);}
});
