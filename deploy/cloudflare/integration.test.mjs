import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {fixture} from './helpers/worker.mjs';
import {handleBuffett} from '../src/features/buffett/routes.js';
test('home and global navigation link the Buffett subpage',async()=>{
  const f=fixture();try{const r=await f.request('/');assert.match(r.text,/href="\/buffett\/"/);assert.match(r.text,/巴菲特指数/);}finally{f.close();}
});
test('imported Buffett assets match publication and are reachable only through whitelist',async()=>{
  const manifest=JSON.parse(fs.readFileSync(new URL('../docs/design/buffett/source-manifest.json',import.meta.url)));
  for(const file of manifest.files){const body=fs.readFileSync(new URL('../public/buffett/'+file.name,import.meta.url));assert.equal(createHash('sha256').update(body).digest('hex'),file.sha256);}
  const env={STOCKCHECK_ASSETS:{fetch:async request=>{const p=new URL(request.url).pathname;return new Response(fs.readFileSync(new URL('../public'+p,import.meta.url)));}}};
  const req=p=>new Request('https://test.example'+p);
  const res=await handleBuffett(req('/buffett/'),env);assert.equal(res.status,200);assert.match(await res.text(),/data-field="bi"/);
  assert.equal((await handleBuffett(req('/buffett/archive/a.zip'),env)).status,404);
  assert.equal((await handleBuffett(req('/buffett/updates/snapshots/private.json'),env)).status,404);
  const fixed=manifest.files.find(f=>f.zone==='fixed');
  assert.match((await handleBuffett(req('/buffett/'+fixed.name),env)).headers.get('Cache-Control'),/private.*immutable/);
  const current=await handleBuffett(req('/buffett/updates/current.json'),env);
  assert.match(current.headers.get('Cache-Control'),/must-revalidate/);
  const metadata=await current.json();assert.equal(metadata.recent_window,8);assert.ok(metadata.model.n>=298);
  const recent=await handleBuffett(req('/buffett/updates/recent.json'),env);assert.equal((await recent.json()).values.length,8);
  assert.equal((await handleBuffett(req('/buffett'),env)).status,301);
});
