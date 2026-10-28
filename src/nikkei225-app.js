import {freshness} from './freshness.js';
import {fetchNikkei225 as fetchSnapshot,renderNikkei225Chart as renderChart} from './nikkei225.js';
const root=document.querySelector('#nikkei225');
const find=selector=>root.querySelector(selector);
const text=(selector,value)=>{find(selector).textContent=value;};
const field=(name,value)=>text(`[data-field="${name}"]`,value);
const fmt=(value,signed=false)=>`${signed&&value>0?'+':''}${value.toFixed(2)}`;
let loaded=null,busy=false;
const blobs=new Map();
function download(selector,body,type,name){
  if(blobs.has(selector))URL.revokeObjectURL(blobs.get(selector));
  const url=URL.createObjectURL(new Blob([body],{type}));blobs.set(selector,url);
  const anchor=find(selector);anchor.href=url;anchor.download=name;anchor.removeAttribute('aria-disabled');
}
function updateStatus(){
  if(!loaded)return;
  const {updated_on,refresh_interval_months,warning_lead_days}=loaded.current,{stale,near,dueOn}=freshness(updated_on,refresh_interval_months,warning_lead_days),status=find('.status');
  status.classList.toggle('active',stale||near);status.classList.toggle('stale',stale);
  if(!stale&&!near)return;
  text('#status-label',stale?'需要更新':'即将到期');
  text('#status-title',stale?'日经 225 已到两个月更新期限':'日经 225 更新期限临近');
  text('#status-detail',stale?`快照最后更新于 ${updated_on}，两个月更新期限为 ${dueOn}。请维护者核查并更新；当前数值保留供历史参考。`:`快照最后更新于 ${updated_on}，两个月更新期限为 ${dueOn}。请维护者安排核查更新。`);
}
async function load(){
  if(busy)return;busy=true;find('#nikkei225-retry').hidden=true;
  try{
    const result=await fetchSnapshot(),{current,model,sources}=result,last=model.rows.at(-1);
    const historical=renderChart(model,current,false),detrended=renderChart(model,current,true);
    find('#nikkei225-historical-chart').innerHTML=historical;find('#nikkei225-detrended-chart').innerHTML=detrended;
    field('period',current.data_through);field('coverage',`全历史 1972-11 — ${current.data_through} · ${model.n} 月`);
    field('bi',fmt(last.price));field('deviation',fmt(last.deviation_pct,true));field('trend',fmt(last.trend_price));field('z',fmt(last.z_score,true));
    field('dates',`数据截至 ${last.period_end}（${current.data_through}）；快照最后更新 ${current.updated_on}。`);
    find('.metrics').setAttribute('aria-busy','false');
    download('#nikkei225-download-historical',historical,'image/svg+xml','Nikkei225_Historical.svg');
    download('#nikkei225-download-detrended',detrended,'image/svg+xml','Nikkei225_Detrended.svg');
    download('#nikkei225-download-snapshot',JSON.stringify({...current,rows:model.rows,sources},null,2)+'\n','application/json','Nikkei225_Snapshot.json');
    loaded=result;updateStatus();
  }catch(error){
    find('.status').classList.add('active','stale');text('#status-label','读取失败');text('#status-title','日经快照读取失败，请重试');text('#status-detail',error.message+'。未展示未经核验的组合数据。');find('#nikkei225-retry').hidden=false;
  }finally{busy=false;}
}
find('#nikkei225-retry').addEventListener('click',load);
setInterval(updateStatus,60_000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)updateStatus();});
load();
