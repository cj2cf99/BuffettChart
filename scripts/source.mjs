import fs from 'node:fs';
import {safePath,sha256} from './io.mjs';
import {computeModel} from './model.mjs';
import {addCalendarMonths} from '../src/freshness.js';
export const BASELINE_HASH='811a45df3978d0e4e41d85012a737683014f5eba579ba5584a92536e2af68b1a';
export const BASE_THROUGH='2024Q2';
export const WINDOW=8;
export function loadSource(root) {
  const bytes=fs.readFileSync(safePath(root,'data/fixed/baseline-v1.json'));
  if(sha256(bytes)!==BASELINE_HASH)throw new Error('Frozen baseline hash mismatch');
  const baseline=JSON.parse(bytes);
  const current=JSON.parse(fs.readFileSync(safePath(root,'data/updates/current.json')));
  if(current.schema_version!==2||current.recent_window!==WINDOW||current.base_through!==BASE_THROUGH)throw new Error('Partition contract mismatch');
  const checked=ref=>{
    if(!ref||!/^[a-f0-9]{64}$/.test(ref.sha256))throw new Error('Missing source hash');
    const bytes=fs.readFileSync(safePath(root,'data/'+ref.file));
    if(sha256(bytes)!==ref.sha256)throw new Error('Source hash mismatch: '+ref.file);
    return JSON.parse(bytes);
  };
  const baseRows=baseline.rows.filter(r=>r.period<=BASE_THROUGH);
  if(baseRows.length!==290)throw new Error('Fixed prefix must have 290 quarters');
  const fixedParts=[{id:'history-base',rows:baseRows}];
  for(const ref of current.fixed_extensions){
    if(!/^fixed\/extensions\/\d{4}Q[1-4]\.[a-f0-9]{16}\.json$/.test(ref.file)||!ref.file.includes(ref.sha256.slice(0,16)))throw new Error('Invalid fixed extension');
    const part=checked(ref);
    if(!Array.isArray(part.rows)||part.rows.length!==1)throw new Error('Fixed extension must hold one quarter');
    fixedParts.push({id:part.rows[0].period,rows:part.rows});
  }
  if(!/^updates\/snapshots\/[A-Za-z0-9_-]+\.json$/.test(current.active.file))throw new Error('Invalid active snapshot');
  const active=checked(current.active);
  if(!/^[A-Za-z0-9_-]+$/.test(active.snapshot_id)||active.rows.length!==WINDOW)throw new Error('Active snapshot must hold 8 quarters');
  addCalendarMonths(active.updated_on,0);
  const fixedRows=fixedParts.flatMap(p=>p.rows);
  const rows=[...fixedRows,...active.rows];
  const input={...baseline,snapshot_id:active.snapshot_id,captured_on:active.updated_on,data_through:active.data_through,rows};
  computeModel(input); // Detect gaps, duplicates, invalid quarters and source units.
  return {baseline,current,active,fixedParts,fixedRows,input};
}
