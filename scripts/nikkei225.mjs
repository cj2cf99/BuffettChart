import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {jsonBytes,safePath,sha256} from './io.mjs';
import {monthKey,monthlyModel} from './sp500.mjs';

export function loadNikkei(root){
  const manifest=JSON.parse(fs.readFileSync(safePath(root,'data/nikkei225/manifest.json')));
  const bytes=fs.readFileSync(safePath(root,manifest.source_file));
  if(createHash('sha256').update(bytes).digest('hex')!==manifest.source_file_sha256)throw Error('Nikkei monthly source checksum mismatch');
  const lines=bytes.toString('utf8').trim().split(/\r?\n/);
  if(lines.shift()!=='Date,Price')throw Error('Nikkei CSV schema mismatch');
  const rows=lines.map(line=>{const [period,raw]=line.split(',');return {period,price:Number(raw)};});
  if(rows.length!==manifest.months||rows.at(-1)?.period!==manifest.data_through||monthKey(rows[0]?.period)!==monthKey(manifest.start))throw Error('Nikkei series range mismatch');
  const model=monthlyModel(rows,manifest.start);
  return {manifest,rows,model};
}

export function buildNikkei(root,add){
  const {manifest,rows,model}=loadNikkei(root);
  const bytes=jsonBytes(rows),hash=sha256(bytes),historyUrl=`nikkei225/fixed/history.${hash.slice(0,16)}.json`;
  add(historyUrl,bytes);
  const current={schema_version:1,indicator:'nikkei225',frequency:'monthly',snapshot_id:manifest.snapshot_id,updated_on:manifest.updated_on,data_through:manifest.data_through,source:manifest.source,source_url:manifest.source_url,source_note:manifest.source_note,refresh_interval_months:2,warning_lead_days:14,history:{url:historyUrl,sha256:hash,months:rows.length},model:{n:model.n,a:model.a,b_per_year:model.b_per_year,sigma_log:model.sigma_log,sigma_ddof:2},latest:model.rows.at(-1)};
  add('nikkei225/updates/current.json',jsonBytes(current));
  return current;
}
