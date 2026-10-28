import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=fileURLToPath(new URL('../',import.meta.url));
const target=path.resolve(process.argv[2]||'G:/cloudflare/myapp');
if(!fs.existsSync(path.join(target,'src/router.js')))throw new Error('Expected existing myapp checkout');
const read=p=>fs.readFileSync(path.join(root,p));
const publication=JSON.parse(read('publication.json'));
const allowed=['index.html','style.css','app.js','freshness.js','snapshot.json','historical.svg','detrended.svg'];
if(publication.files.length!==allowed.length||publication.files.some(f=>!allowed.includes(f.name)))throw new Error('Unexpected public assets');
for(const f of publication.files)if(createHash('sha256').update(read('dist/'+f.name)).digest('hex')!==f.sha256)throw new Error('Build first; publication mismatch');
const changes=new Map();
const modify=(rel,transform)=>{const file=path.join(target,rel);changes.set(file,transform(fs.readFileSync(file,'utf8')));};
modify('src/router.js',text=>{
  if(!text.includes("from './features/buffett/routes.js'"))text="import { handleBuffett } from './features/buffett/routes.js';\n"+text;
  if(!text.includes('const buffett = await handleBuffett')){
    const anchor='\t\tconst stockcheck = await handleStockcheck(request, env);';
    if(!text.includes(anchor))throw new Error('Router changed; review integration');
    text=text.replace(anchor,'\t\tconst buffett = await handleBuffett(request, env);\n\t\tif (buffett) return buffett;\n'+anchor);
  }return text;
});
modify('src/pages/home.html',text=>{
  if(text.includes('href="/buffett/"'))return text;
  const anchor='\t</div>\r\n</section>';
  const marker=text.includes(anchor)?anchor:'\t</div>\n</section>';
  if(!text.includes(marker))throw new Error('Home changed; review integration');
  return text.replace(marker,'\t\t<a class="portal buffett-portal" href="/buffett/"><span class="icon" aria-hidden="true">≈</span><h2>巴菲特指数</h2><p class="muted">查看美国市场标准指数、去趋势偏离与季度快照。</p><span class="enter">进入巴菲特指数 →</span></a>\n'+marker);
});
modify('src/pages/layout.html',text=>text.includes('href="/buffett/"')?text:text.replace('<a href="/stockcheck/">个股监察</a>','<a href="/stockcheck/">个股监察</a>\n\t\t\t\t<a href="/buffett/">巴菲特指数</a>'));
const section='\n\n## 巴菲特指数集成\n\n独立只读二级页 `/buffett/`，首页与全站导航可进入；顶部展示末期标准指数、去趋势百分比、趋势与 Z-score。快照超过五个日历月未更新时提示更新（Asia/Shanghai）。\n\n来源仓库：https://github.com/cj2cf99/BuffettChart 。更新在来源项目运行 `npm run build`、`npm test`、`npm run integrate -- <myapp路径>`，然后在 myapp 执行 `npm test`、`npm run check`。详见 [接入说明](buffett/README.md)。不新增 API、数据库表、KV 键或定时任务。\n';
modify('docs/design/README.md',text=>text.includes('## 巴菲特指数集成')?text:text+section);
for(const rel of ['docs/design/api.md','docs/design/database/README.md','docs/design/kv/README.md','docs/design/pages-and-features.md'])modify(rel,text=>text.includes('<!-- buffett-integration -->')?text:text+'\n\n<!-- buffett-integration -->\n巴菲特指数：`/buffett/` 为独立静态只读页面，无 API、D1 或 KV 变更；末值与两张图来自同一已核验快照。接入详见 docs/design/buffett/README.md。\n');
for(const f of publication.files)changes.set(path.join(target,'public/buffett',f.name),read('dist/'+f.name));
changes.set(path.join(target,'src/features/buffett/routes.js'),read('deploy/cloudflare/routes.js'));
changes.set(path.join(target,'tests/buffett.test.mjs'),read('deploy/cloudflare/integration.test.mjs'));
changes.set(path.join(target,'docs/design/buffett/README.md'),read('docs/cloudflare.md'));
changes.set(path.join(target,'docs/design/buffett/source-manifest.json'),JSON.stringify(publication,null,2)+'\n');
const attrs=path.join(target,'../.gitattributes');
let attrText=fs.existsSync(attrs)?fs.readFileSync(attrs,'utf8'):'';
if(!attrText.includes('myapp/public/buffett/** -text'))changes.set(attrs,attrText+'\nmyapp/public/buffett/** -text\n');
// Preflight all destinations before the first write; reject linked destinations.
for(const file of changes.keys()){
  let check=file;
  while(check!==path.dirname(check)){
    if(fs.existsSync(check)&&fs.lstatSync(check).isSymbolicLink())throw new Error('Symlink destination refused');
    check=path.dirname(check);
  }
}
let written=0;
for(const [file,body]of changes){
  const next=Buffer.from(body);
  if(fs.existsSync(file)&&fs.readFileSync(file).equals(next))continue;
  fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,next);written++;
}
console.log(`Integrated /buffett/ into ${target}; ${written} files changed. Cloudflare deployment is separate.`);
