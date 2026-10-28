import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {publicAsset} from '../deploy/cloudflare/routes.js';
const dir = fileURLToPath(new URL('../dist/',import.meta.url));
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.json':'application/json'};
http.createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/'){res.writeHead(302,{Location:'/buffett/'}).end();return;}
  if(url.pathname==='/buffett'){res.writeHead(301,{Location:'/buffett/'}).end();return;}
  const name=url.pathname==='/buffett/'?'index.html':url.pathname.slice('/buffett/'.length);
  if(!url.pathname.startsWith('/buffett/')||!publicAsset(name)||!fs.existsSync(path.join(dir,name))){res.writeHead(404).end();return;}
  res.writeHead(200,{'Content-Type':types[path.extname(name)],'Cache-Control':'no-store'});
  res.end(fs.readFileSync(path.join(dir,name)));
}).listen(4173,'127.0.0.1',()=>console.log('BuffettChart preview: http://127.0.0.1:4173/buffett/'));
