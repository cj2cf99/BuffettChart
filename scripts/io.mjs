import fs from 'node:fs';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
export const jsonBytes = value => Buffer.from(JSON.stringify(value,null,2)+'\n');
export function safePath(root,relative) {
  if(typeof relative!=='string'||!relative||relative.includes('\\')||relative.split('/').some(p=>!p||p==='.'||p==='..'))throw new Error('Unsafe relative path');
  const resolved=path.resolve(root,relative);
  if(!resolved.startsWith(path.resolve(root)+path.sep))throw new Error('Path outside project');
  let p=resolved;
  while(p!==path.dirname(p)){
    if(fs.existsSync(p)&&fs.lstatSync(p).isSymbolicLink())throw new Error('Symlink refused');
    p=path.dirname(p);
  }
  return resolved;
}
export function writeChanged(file,bytes,{immutable=false}={}) {
  bytes=Buffer.from(bytes);
  if(fs.existsSync(file)){
    if(fs.readFileSync(file).equals(bytes))return false;
    if(immutable)throw new Error('Immutable file cannot be overwritten: '+file);
  }
  fs.mkdirSync(path.dirname(file),{recursive:true});
  const temp=file+'.'+randomUUID()+'.tmp';
  try{fs.writeFileSync(temp,bytes);fs.renameSync(temp,file);}finally{if(fs.existsSync(temp))fs.unlinkSync(temp);}
  return true;
}
