import {freshness} from './freshness.d887fb054af10460.js';
import {fetchSnapshot} from './series.ecd9c08f754a0562.js';
import {renderChart} from './chart.24589327a6e5101d.js';
const find=id=>document.querySelector(id);
const text=(id,value)=>{find(id).textContent=value;};
const field=(name,value)=>text(`[data-field="${name}"]`,value);
const fmt=(value,signed=false)=>`${signed&&value>0?'+':''}${value.toFixed(2)}`;
let loaded=null,busy=false;
const blobs=new Map();
function download(id,body,type,name){
  if(blobs.has(id))URL.revokeObjectURL(blobs.get(id));
  const url=URL.createObjectURL(new Blob([body],{type}));blobs.set(id,url);
  const anchor=find(id);anchor.href=url;anchor.download=name;anchor.removeAttribute('aria-disabled');
}
function updateStatus(){
  if(!loaded)return;
  const {updated_on}=loaded.current,{stale,dueOn}=freshness(updated_on);
  find('.status').classList.toggle('stale',stale);
  text('#status-label',stale?'需要更新':'季度快照');
  text('#status-title',stale?'数据超过 5 个月未更新，请更新后再观察':'当前展示已保存的季度快照');
  text('#status-detail',stale?`快照最后更新于 ${updated_on}，已超过 ${dueOn} 的五个月期限。请维护者核查官方数据并更新；当前数值保留供历史参考。`:`快照最后更新于 ${updated_on}。如到 ${dueOn} 后仍未更新，这里将提示需要更新。`);
}
async function load(){
  if(busy)return;busy=true;find('#retry').hidden=true;
  try{
    const result=await fetchSnapshot(),{current,model,sources}=result,last=model.rows.at(-1);
    const historical=renderChart(model,current,false),detrended=renderChart(model,current,true);
    find('#historical-chart').innerHTML=historical;find('#detrended-chart').innerHTML=detrended;
    field('period',current.data_through);field('coverage',`全历史 1952Q1 — ${current.data_through} · ${model.n} 季`);
    field('bi',fmt(last.bi_pct));field('deviation',fmt(last.deviation_pct,true));field('trend',fmt(last.trend_pct));field('z',fmt(last.z_score,true));
    field('dates',`数据截至 ${last.period_end}（${current.data_through}）；快照最后更新 ${current.updated_on}。`);field('snapshot',current.snapshot_id);
    find('.metrics').setAttribute('aria-busy','false');
    download('#download-historical',historical,'image/svg+xml','Buffett_Historical.svg');
    download('#download-detrended',detrended,'image/svg+xml','Buffett_Detrended.svg');
    download('#download-snapshot',JSON.stringify({...current,rows:model.rows,sources},null,2)+'\n','application/json','Buffett_Snapshot.json');
    loaded=result;updateStatus();
  }catch(error){
    find('.status').classList.add('stale');text('#status-label','读取失败');
    text('#status-title','快照读取失败，请重试');text('#status-detail',error.message+'。未展示未经核验的组合数据。');
    find('#retry').hidden=false;
  }finally{busy=false;}
}
find('#retry').addEventListener('click',load);
setInterval(updateStatus,60_000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)updateStatus();});
load();
