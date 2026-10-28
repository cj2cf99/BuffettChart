import {freshness} from './freshness.c6b2bd329489bcd2.js';
import {fetchSnapshot} from './series.afe713bd1aed438f.js';
import {renderChart} from './chart.ec5342a3d609f172.js';
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
  const {updated_on,refresh_interval_months,warning_lead_days}=loaded.current,{stale,near,dueOn}=freshness(updated_on,refresh_interval_months,warning_lead_days),status=find('.status');
  status.classList.toggle('active',stale||near);
  status.classList.toggle('stale',stale);
  if(!stale&&!near)return;
  text('#status-label',stale?'需要更新':'即将到期');
  text('#status-title',stale?'已到巴菲特指数六个月更新期限':'巴菲特指数更新期限临近');
  text('#status-detail',stale?`快照最后更新于 ${updated_on}，六个月更新期限为 ${dueOn}。请维护者核查并更新；当前数值保留供历史参考。`:`快照最后更新于 ${updated_on}，六个月更新期限为 ${dueOn}。请维护者安排核查更新。`);
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
    find('.status').classList.add('active','stale');text('#status-label','读取失败');
    text('#status-title','快照读取失败，请重试');text('#status-detail',error.message+'。未展示未经核验的组合数据。');
    find('#retry').hidden=false;
  }finally{busy=false;}
}
find('#retry').addEventListener('click',load);
setInterval(updateStatus,60_000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)updateStatus();});
load();
