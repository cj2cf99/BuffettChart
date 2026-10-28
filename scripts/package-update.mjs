import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {sha256,jsonBytes,safePath} from './io.mjs';
import {publicAsset} from '../deploy/cloudflare/routes.js';
export function packageUpdate(root,previousBytes,out){
  const previous=JSON.parse(previousBytes),currentBytes=fs.readFileSync(path.join(root,'publication.json')),current=JSON.parse(currentBytes);
  if(current.schema_version!==2||!Array.isArray(previous.files))throw new Error('Invalid publication manifest');
  const previousMap=new Map(previous.files.map(f=>[f.name,f.sha256]));
  const files=current.files.filter(f=>f.sha256!==previousMap.get(f.name));
  for(const file of current.files){
    if(!publicAsset(file.name))throw new Error('Unexpected public path');
    const bytes=fs.readFileSync(safePath(path.join(root,'dist'),file.name));
    if(sha256(bytes)!==file.sha256)throw new Error('Build and publication mismatch');
  }
  if(fs.existsSync(out))throw new Error('Output directory must be new');
  const manifest={schema_version:1,base_publication_sha256:sha256(previousBytes),next_publication_sha256:sha256(currentBytes),
    snapshot_id:current.snapshot_id,changed_asset_bytes:files.reduce((n,f)=>n+f.bytes,0),files,
    note:'Overlay assets on the matching base publication; retain old fixed assets. Publish recent.json before current.json or switch atomically. Not a full standalone website.'};
  fs.mkdirSync(out,{recursive:true});
  for(const file of files){const dest=safePath(path.join(out,'assets'),file.name);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(safePath(path.join(root,'dist'),file.name),dest);}
  fs.writeFileSync(path.join(out,'publication.json'),currentBytes);fs.writeFileSync(path.join(out,'delta-manifest.json'),jsonBytes(manifest));
  return manifest;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  if(process.argv.length!==4)throw new Error('Usage: npm run package:update -- previous-publication.json new-output-directory');
  const root=fileURLToPath(new URL('../',import.meta.url));
  const result=packageUpdate(root,fs.readFileSync(path.resolve(process.argv[2])),path.resolve(process.argv[3]));
  console.log(JSON.stringify({changed_files:result.files.length,changed_asset_bytes:result.changed_asset_bytes,output:path.resolve(process.argv[3])},null,2));
}
