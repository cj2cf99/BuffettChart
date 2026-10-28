import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadSource,BASELINE_HASH} from './source.mjs';
import {computeModel} from './model.mjs';
import {buildSP500} from './sp500.mjs';
import {sha256,jsonBytes,writeChanged,safePath} from './io.mjs';
export function build(root=fileURLToPath(new URL('../',import.meta.url))) {
  const read=p=>fs.readFileSync(safePath(root,p));
  const state=loadSource(root),{input,active}=state,model=computeModel(input),last=model.rows.at(-1);
  const outputs=new Map(),fixed=[];
  const add=(name,bytes)=>{outputs.set(name,Buffer.from(bytes));return name;};
  for(const part of state.fixedParts){
    const bytes=Buffer.from(JSON.stringify({start:part.rows[0].period,values:part.rows.map(r=>Number(r.buffett_indicator_pct)),...(part.id==='history-base'?{sources:state.baseline.sources}:{})})+'\n');
    const hash=sha256(bytes),name=`fixed/${part.id==='history-base'?'history':part.id}.${hash.slice(0,16)}.json`;
    add(name,bytes);fixed.push({url:name,sha256:hash,quarters:part.rows.length});
  }
  const recentBytes=Buffer.from(JSON.stringify({start:active.rows[0].period,values:active.rows.map(r=>Number(r.buffett_indicator_pct))})+'\n');
  add('updates/recent.json',recentBytes);
  const current={schema_version:2,snapshot_id:input.snapshot_id,updated_on:active.updated_on,data_through:input.data_through,data_through_date:last.period_end,
    source_note:active.source_note,revision_reason:active.revision_reason,
    recent_window:8,fixed_through:state.fixedRows.at(-1).period,fixed,recent:{url:'updates/recent.json',sha256:sha256(recentBytes),quarters:8},
    baseline_sha256:BASELINE_HASH,rows_sha256:sha256(Buffer.from(JSON.stringify(input.rows))),model:{n:model.n,a:model.a,b_per_year:model.b_per_year,sigma_log:model.sigma_log,sigma_ddof:2},latest:last};
  add('updates/current.json',jsonBytes(current));
  buildSP500(root,add);
  const moduleNames={};
  for(const name of ['freshness','series','chart']){
    const bytes=read('src/'+name+'.js');moduleNames[name]=`fixed/${name}.${sha256(bytes).slice(0,16)}.js`;add(moduleNames[name],bytes);
  }
  let app=read('src/app.js').toString();
  for(const name of ['freshness','series','chart'])app=app.replace(`'./${name}.js'`,`'./${path.posix.basename(moduleNames[name])}'`);
  const appName=`fixed/app.${sha256(app).slice(0,16)}.js`;add(appName,app);
  let spModule=read('src/sp500.js').toString().replace("'./chart.js'",`'./${path.posix.basename(moduleNames.chart)}'`);
  const spName=`fixed/sp500.${sha256(spModule).slice(0,16)}.js`;add(spName,spModule);
  let spApp=read('src/sp500-app.js').toString().replace("'./freshness.js'",`'./${path.posix.basename(moduleNames.freshness)}'`).replace("'./sp500.js'",`'./${path.posix.basename(spName)}'`);
  const spAppName=`fixed/sp500-app.${sha256(spApp).slice(0,16)}.js`;add(spAppName,spApp);
  const css=read('src/style.css'),cssName=`fixed/style.${sha256(css).slice(0,16)}.css`;add(cssName,css);
  const legend=`<div class="legend" aria-label="图例"><span><i class="actual"></i>指数 / 偏离</span><span><i style="--color:#818b95"></i>趋势基准</span>${[[-2,'#2e7951'],[-1,'#8abb77'],[1,'#df8b25'],[2,'#c64b4b']].map(([k,color])=>`<span><i style="--color:${color}"></i>${k>0?'+':''}${k}σ</span>`).join('')}</div>`;
  const html=read('src/index.html').toString().replace('{{STYLE_URL}}','./'+cssName).replace('{{APP_URL}}','./'+appName).replace('{{SP500_APP_URL}}','./'+spAppName).replaceAll('{{LEGEND}}',legend);
  if(html.includes('{{'))throw new Error('Unresolved template');
  add('index.html',html);
  const dist=path.join(root,'dist'),written=[];
  for(const [name,bytes]of outputs)if(writeChanged(safePath(dist,name),bytes,{immutable:name.startsWith('fixed/')||name.includes('/fixed/')}))written.push(name);
  // One-time removal of redundant v1 generated copies, never source data.
  for(const name of ['app.js','freshness.js','style.css','historical.svg','detrended.svg','snapshot.json']){
    const file=safePath(dist,name);if(fs.existsSync(file))fs.unlinkSync(file);
  }
  const publication={schema_version:2,snapshot_id:input.snapshot_id,updated_on:active.updated_on,
    files:[...outputs].sort(([a],[b])=>a.localeCompare(b)).map(([name,bytes])=>({name,zone:name.startsWith('fixed/')||name.includes('/fixed/')?'fixed':name.includes('updates/')?'updates':'shell',bytes:bytes.length,sha256:sha256(bytes)}))};
  writeChanged(path.join(root,'publication.json'),jsonBytes(publication));
  return {publication,written};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const result=build();
  console.log(JSON.stringify({changed_files:result.written.length,changed_bytes:result.publication.files.filter(f=>result.written.includes(f.name)).reduce((n,f)=>n+f.bytes,0),files:result.written},null,2));
}
