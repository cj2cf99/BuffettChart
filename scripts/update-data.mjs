import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {isDeepStrictEqual} from 'node:util';
import {loadSource,WINDOW} from './source.mjs';
import {sha256,jsonBytes,safePath,writeChanged} from './io.mjs';
import {computeModel} from './model.mjs';
import {addCalendarMonths} from '../src/freshness.js';
export function planUpdate(root,candidate,{acceptRevisions=false,preview=false}={}) {
  const state=loadSource(root),old=state.input;
  if(!candidate||!Array.isArray(candidate.rows)||!candidate.rows.length)throw new Error('Candidate must contain rows');
  if(!/^[A-Za-z0-9_-]+$/.test(candidate.snapshot_id||'')||candidate.snapshot_id===old.snapshot_id)throw new Error('Use a new snapshot_id');
  addCalendarMonths(candidate.updated_on,0);
  if(candidate.updated_on<state.active.updated_on)throw new Error('Update date cannot move backwards');
  if(typeof candidate.source_note!=='string'||!candidate.source_note.trim())throw new Error('source_note is required');
  const known=new Map(old.rows.map(r=>[r.period,r]));
  const fixedThrough=state.fixedRows.at(-1).period;
  const revisions=[],appended=[],seen=new Set();
  for(const row of candidate.rows){
    if(seen.has(row.period))throw new Error('Duplicate candidate quarter');seen.add(row.period);
    const prior=known.get(row.period);
    const equal=prior&&isDeepStrictEqual(prior,row);
    if(row.period<=fixedThrough){
      if(!equal)throw new Error('Fixed history cannot be revised: '+row.period);
      continue;
    }
    if(prior&&!equal)revisions.push({period:row.period,before:prior,after:row});
    else if(!prior)appended.push(row.period);
    known.set(row.period,row);
  }
  const needsAcceptance=revisions.length>0&&(!acceptRevisions||typeof candidate.revision_reason!=='string'||!candidate.revision_reason.trim());
  if(needsAcceptance&&!preview)throw new Error('Recent revisions require --accept-revisions and revision_reason');
  const rows=[...known.values()].sort((a,b)=>a.period.localeCompare(b.period));
  const input={...old,rows,data_through:rows.at(-1).period};
  computeModel(input); // Validate everything before any write, including new source values.
  if(!revisions.length&&!appended.length)return {changes:[],no_change:true,appended,revisions:[],promoted:[]};
  const count=rows.length-WINDOW;
  const promoted=rows.slice(state.fixedRows.length,count);
  const extensions=[...state.current.fixed_extensions],changes=[];
  for(const row of promoted){
    const bytes=jsonBytes({rows:[row]}),hash=sha256(bytes);
    const file=`fixed/extensions/${row.period}.${hash.slice(0,16)}.json`;
    extensions.push({file,sha256:hash});changes.push({relative:'data/'+file,bytes,immutable:true});
  }
  const active={snapshot_id:candidate.snapshot_id,updated_on:candidate.updated_on,data_through:input.data_through,source_note:candidate.source_note,
    revision_reason:revisions.length?candidate.revision_reason:null,rows:rows.slice(-WINDOW)};
  const activeBytes=jsonBytes(active),activeFile=`updates/snapshots/${candidate.snapshot_id}.json`;
  changes.push({relative:'data/'+activeFile,bytes:activeBytes,immutable:true});
  const audit={snapshot_id:active.snapshot_id,previous_snapshot:old.snapshot_id,updated_on:active.updated_on,source_note:candidate.source_note,
    revision_reason:active.revision_reason,appended,revisions,promoted:promoted.map(r=>r.period)};
  changes.push({relative:`data/updates/audit/${active.snapshot_id}.json`,bytes:jsonBytes(audit),immutable:true});
  const current={...state.current,fixed_extensions:extensions,active:{file:activeFile,sha256:sha256(activeBytes)}};
  changes.push({relative:'data/updates/current.json',bytes:jsonBytes(current),immutable:false}); // Commit pointer last.
  return {changes,no_change:false,requires_revision_acceptance:needsAcceptance,revision_details:revisions,expected_current_sha256:sha256(fs.readFileSync(safePath(root,'data/updates/current.json'))),appended,revisions:revisions.map(r=>r.period),promoted:promoted.map(r=>r.period)};
}
export function applyUpdate(root,plan) {
  if(plan.no_change)return;
  if(plan.requires_revision_acceptance)throw new Error('Preview cannot be applied without revision acceptance');
  if(sha256(fs.readFileSync(safePath(root,'data/updates/current.json')))!==plan.expected_current_sha256)throw new Error('Current snapshot changed; re-plan before applying');
  for(const item of plan.changes){
    const file=safePath(root,item.relative);
    if(item.immutable&&fs.existsSync(file)&&!fs.readFileSync(file).equals(item.bytes))throw new Error('Snapshot identity already used: '+item.relative);
  }
  for(const item of plan.changes)writeChanged(safePath(root,item.relative),item.bytes,{immutable:item.immutable});
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const root=fileURLToPath(new URL('../',import.meta.url)),args=process.argv.slice(2);
  const file=args.find(a=>!a.startsWith('--'));
  if(!file)throw new Error('Usage: npm run data:update -- candidate.json [--accept-revisions] [--apply]');
  if(args.some(a=>a.startsWith('--')&&!['--apply','--accept-revisions'].includes(a)))throw new Error('Unknown option');
  const candidate=JSON.parse(fs.readFileSync(path.resolve(file)));
  const plan=planUpdate(root,candidate,{acceptRevisions:args.includes('--accept-revisions'),preview:!args.includes('--apply')});
  console.log(JSON.stringify({mode:args.includes('--apply')?'apply':'preview',requires_revision_acceptance:plan.requires_revision_acceptance||false,appended:plan.appended,revisions:plan.revision_details||[],promoted:plan.promoted,files:plan.changes.map(c=>({file:c.relative,bytes:c.bytes.length}))},null,2));
  if(args.includes('--apply'))applyUpdate(root,plan);
}
