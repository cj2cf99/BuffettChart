import {renderChart} from './chart.ec5342a3d609f172.js';
export function renderSP500Chart(model,current,detrended){return renderChart({...model,rows:model.rows.map(r=>({...r,bi_pct:r.price,trend_pct:r.trend_price}))},current,detrended);}
export async function fetchSP500(base=new URL('./',location.href),fetcher=fetch){
  async function load(ref){
    if(!/^sp500\/(?:updates\/(?:current|recent)\.json|fixed\/(?:history|\d{4}-\d{2})\.[a-f0-9]{16}\.json)$/.test(ref.url))throw Error('非法标普数据路径');
    const res=await fetcher(new URL(ref.url,base),{cache:ref.url.includes('/fixed/')?'default':'no-cache'});if(!res.ok)throw Error('标普快照读取失败');const bytes=await res.arrayBuffer();
    if(ref.sha256){const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');if(hash!==ref.sha256)throw Error('标普数据版本不一致');}
    return JSON.parse(new TextDecoder().decode(bytes));
  }
  for(let attempt=0;attempt<2;attempt++)try{
    const current=await load({url:'sp500/updates/current.json'});
    if(current.indicator!=='sp500'||current.frequency!=='monthly'||current.window_months!==24||current.refresh_interval_months!==2||current.warning_lead_days!==14||!/^[A-Za-z0-9_-]+$/.test(current.snapshot_id)||!/^\d{4}-\d{2}-\d{2}$/.test(current.updated_on))throw Error('标普配置无效');
    const all=await Promise.all([...current.fixed,current.recent].map(load)),raw=all.flat();if(all.at(-1).length!==24||raw.length!==current.model.n)throw Error('标普期数不匹配');
    const m=current.model;if(![m.a,m.b_per_year,m.sigma_log].every(Number.isFinite)||m.sigma_log<=0||m.sigma_ddof!==2)throw Error('标普模型无效');
    const rows=raw.map((r,i)=>{const key=1957*12+2+i,period=`${Math.floor(key/12)}-${String(key%12+1).padStart(2,'0')}`;if(r.period!==period||!Number.isFinite(r.price)||r.price<=0)throw Error('标普月份不连续');const residual=Math.log(r.price)-m.a-m.b_per_year*i/12;return {...r,period_end:new Date(Date.UTC(Math.floor(key/12),key%12+1,0)).toISOString().slice(0,10),trend_price:Math.exp(m.a+m.b_per_year*i/12),deviation_pct:Math.expm1(residual)*100,z_score:residual/m.sigma_log};});
    if(rows.at(-1).period!==current.data_through)throw Error('标普末期不匹配');for(const k of ['price','trend_price','deviation_pct','z_score'])if(!Number.isFinite(current.latest[k])||Math.abs(rows.at(-1)[k]-current.latest[k])>1e-8)throw Error('标普末值不一致');
    return {current,model:{...m,rows},sources:{url:current.source_url,definition:current.source}};
  }catch(error){if(attempt===1)throw error;}
}
