import {renderChart} from './chart.ec5342a3d609f172.js';

export function renderNikkei225Chart(model,current,detrended){
  return renderChart({...model,rows:model.rows.map(row=>({...row,bi_pct:row.price,trend_pct:row.trend_price}))},current,detrended);
}

export async function fetchNikkei225(base=new URL('./',location.href),fetcher=fetch){
  const load=async ref=>{
    if(!/^nikkei225\/fixed\/history\.[a-f0-9]{16}\.json$/.test(ref.url))throw Error('非法日经历史数据路径');
    const response=await fetcher(new URL(ref.url,base),{cache:'default'});
    if(!response.ok)throw Error('日经历史数据读取失败');
    const bytes=await response.arrayBuffer();
    const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),value=>value.toString(16).padStart(2,'0')).join('');
    if(hash!==ref.sha256)throw Error('日经数据版本不一致');
    return JSON.parse(new TextDecoder().decode(bytes));
  };
  const response=await fetcher(new URL('nikkei225/updates/current.json',base),{cache:'no-cache'});
  if(!response.ok)throw Error('日经快照读取失败');
  const current=await response.json();
  if(current.indicator!=='nikkei225'||current.frequency!=='monthly'||current.refresh_interval_months!==2||current.warning_lead_days!==14||!/^[A-Za-z0-9_-]+$/.test(current.snapshot_id)||!/^\d{4}-\d{2}-\d{2}$/.test(current.updated_on)||!/^\d{4}-\d{2}$/.test(current.data_through))throw Error('日经快照配置无效');
  const raw=await load(current.history);
  if(!Array.isArray(raw)||raw.length!==current.history.months||raw.length!==current.model.n||raw[0]?.period!=='1972-11'||raw.at(-1)?.period!==current.data_through)throw Error('日经历史覆盖范围不匹配');
  const n=raw.length,meanT=(n-1)/24,logs=raw.map(row=>Math.log(row.price)),mean=logs.reduce((sum,value)=>sum+value,0)/n;
  let xy=0,xx=0;
  logs.forEach((value,index)=>{const t=index/12-meanT;xy+=t*(value-mean);xx+=t*t;});
  const b=xy/xx,a=mean-b*meanT,residual=logs.map((value,index)=>value-a-b*index/12),sigma=Math.sqrt(residual.reduce((sum,value)=>sum+value*value,0)/(n-2));
  if(!(sigma>0)||current.model.sigma_ddof!==2||Math.abs(current.model.a-a)>1e-12||Math.abs(current.model.b_per_year-b)>1e-12||Math.abs(current.model.sigma_log-sigma)>1e-12)throw Error('日经模型参数无效');
  const rows=raw.map((row,index)=>{
    const key=1972*12+10+index,period=`${Math.floor(key/12)}-${String(key%12+1).padStart(2,'0')}`;
    if(row.period!==period||!Number.isFinite(row.price)||row.price<=0)throw Error('日经月份不连续');
    return {...row,period_end:new Date(Date.UTC(Math.floor(key/12),key%12+1,0)).toISOString().slice(0,10),trend_price:Math.exp(a+b*index/12),deviation_pct:Math.expm1(residual[index])*100,z_score:residual[index]/sigma};
  });
  const model={n,a,b_per_year:b,sigma_log:sigma,sigma_ddof:2,rows};
  for(const key of ['price','trend_price','deviation_pct','z_score'])if(!Number.isFinite(current.latest[key])||Math.abs(rows.at(-1)[key]-current.latest[key])>1e-8)throw Error('日经末期读数不一致');
  return {current,model,sources:{url:current.source_url,definition:current.source}};
}
