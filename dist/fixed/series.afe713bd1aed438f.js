export function periodKey(period) {
  if(!/^\d{4}Q[1-4]$/.test(period))throw new Error('季度格式无效');
  return Number(period.slice(0,4))*4+Number(period.at(-1))-1;
}
export function periodAt(key) { return `${Math.floor(key/4)}Q${key%4+1}`; }
export function assemble(current,parts,recent) {
  if(!/^[A-Za-z0-9_-]+$/.test(current.snapshot_id)||!/^\d{4}-\d{2}-\d{2}$/.test(current.updated_on)||new Date(current.updated_on+'T00:00:00Z').toISOString().slice(0,10)!==current.updated_on)throw new Error('快照元数据无效');
  if(current.schema_version!==2||current.recent_window!==8||current.refresh_interval_months!==6||current.warning_lead_days!==30||recent.values.length!==8||parts.length!==current.fixed.length)throw new Error('数据分区版本不一致');
  const values=[],labels=[];
  for(const [index,part] of [...parts,recent].entries()){
    const start=periodKey(part.start);
    if(start!==1952*4+values.length||!Array.isArray(part.values)||!part.values.length)throw new Error('历史与近期数据不连续');
    if(index<parts.length&&part.values.length!==current.fixed[index].quarters)throw new Error('固定区期数不匹配');
    for(const [i,v]of part.values.entries()){
      if(!Number.isFinite(v)||v<=0)throw new Error('指数数据无效');
      labels.push(periodAt(start+i));values.push(v);
    }
  }
  const m=current.model;
  if(!m||![m.a,m.b_per_year,m.sigma_log].every(Number.isFinite)||m.sigma_log<=0||m.sigma_ddof!==2||m.n!==values.length||labels.at(-1)!==current.data_through)throw new Error('模型与数据不匹配');
  const rows=values.map((v,i)=>{
    const period=labels[i],key=periodKey(period),year=Math.floor(key/4),q=key%4+1;
    const residual=Math.log(v)-m.a-m.b_per_year*i/4;
    return {period,period_end:new Date(Date.UTC(year,q*3,0)).toISOString().slice(0,10),bi_pct:v,
      trend_pct:Math.exp(m.a+m.b_per_year*i/4),deviation_pct:Math.expm1(residual)*100,z_score:residual/m.sigma_log,historical_estimate:i<179};
  });
  for(const key of ['bi_pct','trend_pct','deviation_pct','z_score'])if(!Number.isFinite(current.latest?.[key])||Math.abs(rows.at(-1)[key]-current.latest[key])>1e-8)throw new Error('最新读数与模型不一致');
  if(rows.at(-1).period_end!==current.data_through_date)throw new Error('季度日期不一致');
  return {...m,rows};
}
export function validatePublicURL(ref,kind) {
  const pattern=kind==='fixed'?/^fixed\/(?:history|\d{4}Q[1-4])\.[a-f0-9]{16}\.json$/:/^updates\/recent\.json$/;
  if(!ref||!pattern.test(ref.url)||!/^[a-f0-9]{64}$/.test(ref.sha256))throw new Error('非法数据引用');
  if(kind==='fixed'&&!ref.url.includes(ref.sha256.slice(0,16)))throw new Error('固定区版本无效');
  return ref;
}
export async function fetchSnapshot(base=new URL('./',location.href),fetcher=fetch) {
  const load=async(url,expected)=>{
    const response=await fetcher(new URL(url,base),{cache:expected&&url.startsWith('fixed/')?'default':'no-cache'});
    if(!response.ok)throw new Error('数据暂时不可用（'+response.status+'）');
    const bytes=await response.arrayBuffer();
    if(expected){
      const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
      if(digest!==expected)throw new Error('数据版本不一致，请重试');
    }
    return JSON.parse(new TextDecoder().decode(bytes));
  };
  // If a deployment changes between metadata and recent data fetches, retry
  // the whole snapshot; never render an unverified combination of versions.
  for(let attempt=0;attempt<2;attempt++){
    try{
      const current=await load('updates/current.json');
      if(!Array.isArray(current.fixed)||current.fixed.length<1)throw new Error('固定区清单无效');
      current.fixed.forEach(ref=>validatePublicURL(ref,'fixed'));validatePublicURL(current.recent,'recent');
      const [parts,recent]=await Promise.all([
        Promise.all(current.fixed.map(ref=>load(ref.url,ref.sha256))),load(current.recent.url,current.recent.sha256),
      ]);
      const model=assemble(current,parts,recent);
      return {current,model,sources:parts[0].sources};
    }catch(error){if(attempt===1)throw error;}
  }
}
