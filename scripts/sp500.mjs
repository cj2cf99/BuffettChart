import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {isDeepStrictEqual} from 'node:util';
import {sha256,jsonBytes,safePath,writeChanged} from './io.mjs';
import {addCalendarMonths} from '../src/freshness.js';
export const SP_HASH='39b0b493e846afee31146aa1c4654668eb04462a1a18fa6be86afb1416a60c60';
export const monthKey=s=>{if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(s))throw Error('Invalid month');return Number(s.slice(0,4))*12+Number(s.slice(5))-1;};
export function monthlyModel(rows){
  if(rows.length<24||rows[0].period!=='1957-03')throw Error('SP500 start/window mismatch');
  rows.forEach((r,i)=>{if(Object.keys(r).some(k=>!['period','price'].includes(k))||monthKey(r.period)!==monthKey('1957-03')+i||!Number.isFinite(r.price)||r.price<=0)throw Error('Non-contiguous or invalid monthly price');});
  const n=rows.length,meanT=(n-1)/24,logs=rows.map(r=>Math.log(r.price)),mean=logs.reduce((s,v)=>s+v,0)/n;
  let xy=0,xx=0;logs.forEach((v,i)=>{const t=i/12-meanT;xy+=t*(v-mean);xx+=t*t;});
  const b=xy/xx,a=mean-b*meanT,res=logs.map((v,i)=>v-a-b*i/12),sigma=Math.sqrt(res.reduce((s,v)=>s+v*v,0)/(n-2));
  if(!(sigma>0))throw Error('Degenerate monthly model');
  return {n,a,b_per_year:b,sigma_log:sigma,sigma_ddof:2,rows:rows.map((r,i)=>({...r,period_end:new Date(Date.UTC(Number(r.period.slice(0,4)),Number(r.period.slice(5)),0)).toISOString().slice(0,10),trend_price:Math.exp(a+b*i/12),deviation_pct:Math.expm1(res[i])*100,z_score:res[i]/sigma}))};
}
export function loadSP500(root){
  const raw=fs.readFileSync(safePath(root,'data/sp500/fixed/spx-v1.csv'));if(sha256(raw)!==SP_HASH)throw Error('SP500 frozen baseline hash mismatch');
  const baseline=raw.toString().trim().split(/\r?\n/).slice(1).map(line=>{const [period,p]=line.split(',');return {period,price:Number(p)};});
  const pointer=JSON.parse(fs.readFileSync(safePath(root,'data/sp500/updates/current.json')));
  if(pointer.schema_version!==1||pointer.window_months!==24)throw Error('SP500 monthly partition contract mismatch');
  const checked=ref=>{const b=fs.readFileSync(safePath(root,'data/sp500/'+ref.file));if(sha256(b)!==ref.sha256)throw Error('SP500 part hash mismatch');return JSON.parse(b);};
  const parts=[{id:'history',rows:baseline.slice(0,-24)}];
  for(const ref of pointer.fixed_extensions){if(!/^fixed\/extensions\/\d{4}-\d{2}\.[a-f0-9]{16}\.json$/.test(ref.file)||!ref.file.includes(ref.sha256.slice(0,16)))throw Error('Invalid monthly fixed path');const part=checked(ref);if(part.rows.length!==1)throw Error('One fixed month required');parts.push({id:part.rows[0].period,rows:part.rows});}
  if(!/^updates\/snapshots\/[A-Za-z0-9_-]+\.json$/.test(pointer.active.file))throw Error('Invalid monthly snapshot path');
  const active=checked(pointer.active);addCalendarMonths(active.updated_on,0);
  if(!/^[A-Za-z0-9_-]+$/.test(active.snapshot_id)||active.rows.length!==24)throw Error('24 recent months required');
  const fixed=parts.flatMap(p=>p.rows),rows=[...fixed,...active.rows],model=monthlyModel(rows);
  return {baseline,pointer,parts,fixed,active,rows,model};
}
export function buildSP500(root,add){
  const state=loadSP500(root),{model,active}=state,fixed=[];
  for(const part of state.parts){const bytes=Buffer.from(JSON.stringify(part.rows)+'\n'),hash=sha256(bytes),url=`sp500/fixed/${part.id}.${hash.slice(0,16)}.json`;add(url,bytes);fixed.push({url,sha256:hash,months:part.rows.length});}
  const recent=Buffer.from(JSON.stringify(active.rows)+'\n');add('sp500/updates/recent.json',recent);
  const current={schema_version:1,indicator:'sp500',frequency:'monthly',snapshot_id:active.snapshot_id,updated_on:active.updated_on,data_through:active.rows.at(-1).period,source:'Multpl / Shiller monthly average price; nominal, excluding dividends',source_url:'https://www.multpl.com/s-p-500-historical-prices/table/by-month',source_note:active.source_note,revision_reason:active.revision_reason||null,baseline_sha256:SP_HASH,window_months:24,fixed_through:state.fixed.at(-1).period,fixed,recent:{url:'sp500/updates/recent.json',sha256:sha256(recent)},model:{n:model.n,a:model.a,b_per_year:model.b_per_year,sigma_log:model.sigma_log,sigma_ddof:2},latest:model.rows.at(-1)};
  add('sp500/updates/current.json',jsonBytes(current));return current;
}
export function updateSP500(root,candidate,{apply=false,acceptRevisions=false}={}){
  const s=loadSP500(root),base='data/sp500/',pointerBytes=fs.readFileSync(safePath(root,base+'updates/current.json'));
  if(!candidate||!/^[A-Za-z0-9_-]+$/.test(candidate.snapshot_id)||candidate.snapshot_id===s.active.snapshot_id||!Array.isArray(candidate.rows)||!candidate.rows.length||!candidate.source_note)throw Error('New id, source_note and monthly rows required');
  addCalendarMonths(candidate.updated_on,0);if(candidate.updated_on<s.active.updated_on)throw Error('Update date cannot move backwards');
  const map=new Map(s.rows.map(r=>[r.period,r])),seen=new Set(),revisions=[],appended=[];
  for(const r of candidate.rows){monthKey(r.period);if(seen.has(r.period))throw Error('Duplicate month');seen.add(r.period);const old=map.get(r.period);if(r.period<=s.fixed.at(-1).period&&!isDeepStrictEqual(old,r))throw Error('Fixed SP500 history cannot change');if(old&&!isDeepStrictEqual(old,r))revisions.push({period:r.period,before:old,after:r});if(!old)appended.push(r.period);map.set(r.period,r);}
  const rows=[...map.values()].sort((a,b)=>a.period.localeCompare(b.period)),verified=monthlyModel(rows);
  if(candidate.updated_on<verified.rows.at(-1).period_end)throw Error('Only complete monthly averages may be appended');
  const requiresAcceptance=revisions.length>0&&(!acceptRevisions||!candidate.revision_reason);
  if(apply&&requiresAcceptance)throw Error('Revisions require explicit acceptance and reason');
  if(!revisions.length&&!appended.length)return {changed_files:[],no_change:true};
  const promoted=rows.slice(s.fixed.length,-24),changes=[],extensions=[...s.pointer.fixed_extensions];
  for(const r of promoted){const bytes=jsonBytes({rows:[r]}),hash=sha256(bytes),file=`fixed/extensions/${r.period}.${hash.slice(0,16)}.json`;extensions.push({file,sha256:hash});changes.push({file,bytes,immutable:true});}
  const active={snapshot_id:candidate.snapshot_id,updated_on:candidate.updated_on,source_note:candidate.source_note,revision_reason:candidate.revision_reason||null,rows:rows.slice(-24)},bytes=jsonBytes(active),file=`updates/snapshots/${active.snapshot_id}.json`;
  changes.push({file,bytes,immutable:true},{file:`updates/audit/${active.snapshot_id}.json`,bytes:jsonBytes({previous_snapshot:s.active.snapshot_id,...candidate,revisions,appended,promoted:promoted.map(r=>r.period)}),immutable:true},{file:'updates/current.json',bytes:jsonBytes({...s.pointer,fixed_extensions:extensions,active:{file,sha256:sha256(bytes)}})});
  for(const c of changes){const dest=safePath(root,base+c.file);if(c.immutable&&fs.existsSync(dest)&&!fs.readFileSync(dest).equals(c.bytes))throw Error('Old monthly version cannot be overwritten');}
  if(apply){if(!fs.readFileSync(safePath(root,base+'updates/current.json')).equals(pointerBytes))throw Error('Monthly pointer changed; retry');for(const c of changes)writeChanged(safePath(root,base+c.file),c.bytes,{immutable:c.immutable});}
  return {requires_acceptance:requiresAcceptance,revisions,appended,promoted:promoted.map(r=>r.period),changed_files:changes.map(c=>({file:c.file,bytes:c.bytes.length}))};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const [file,...flags]=process.argv.slice(2);if(!file||flags.some(f=>!['--apply','--accept-revisions'].includes(f)))throw Error('Usage: sp500:update -- candidate.json [--apply] [--accept-revisions]');
  console.log(JSON.stringify(updateSP500(fileURLToPath(new URL('../',import.meta.url)),JSON.parse(fs.readFileSync(file)),{apply:flags.includes('--apply'),acceptRevisions:flags.includes('--accept-revisions')}),null,2));
}
