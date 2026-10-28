export function computeModel(input) {
  const rows = input.rows;
  if (!Array.isArray(rows) || rows.length < 40) throw new Error('At least 40 quarters required');
  let lastQuarter = null;
  for (const [i, row] of rows.entries()) {
    if (!/^\d{4}Q[1-4]$/.test(row.period)) throw new Error('Invalid quarter');
    const year = Number(row.period.slice(0, 4)), quarter = Number(row.period.at(-1));
    const key = year * 4 + quarter - 1;
    if (lastQuarter !== null && key !== lastQuarter + 1) throw new Error('Non-contiguous quarters');
    lastQuarter = key;
    if (row.quarter_label !== `${year}-${String((quarter - 1) * 3 + 1).padStart(2, '0')}-01`) throw new Error('Quarter date mismatch');
    const end=new Date(Date.UTC(year,quarter*3,0)).toISOString().slice(0,10);
    if(row.period_end!==end)throw new Error('Quarter end mismatch');
    const cap = Number(row.market_cap_usd_million), gdp = Number(row.gdp_usd_billion_saar), bi = Number(row.buffett_indicator_pct);
    if (![cap, gdp, bi].every(v => Number.isFinite(v) && v > 0)) throw new Error('Invalid observations');
    if (Math.abs(cap / 1000 / gdp * 100 - bi) > 1e-9) throw new Error('BI unit mismatch');
    if(i>=179){
      const s=row.source_values||{};
      const keys=['BOGZ1LM883164115Q','BOGZ1FL564090005Q','BOGZ1FL554090005Q','GDP'];
      if(keys.some(k=>s[k]===null||s[k]===''||s[k]===undefined))throw new Error('Official source values missing');
      const official=keys.map(k=>Number(s[k]));
      if(!official.every(Number.isFinite)||official.some(v=>v<0)||Math.abs(official[0]-official[1]-official[2]-cap)>1e-6||Math.abs(official[3]-gdp)>1e-9)throw new Error('Official source values mismatch');
    }
    if (row.is_interpolated !== false || row.frozen !== true) throw new Error('Invalid baseline flags');
    if (i < 179 ? row.quality !== 'HISTORICAL_ESTIMATE_FROZEN' || row.is_fitted !== true : row.quality !== 'FED_OFFICIAL_DERIVED' || row.is_fitted !== false) throw new Error('Quality boundary mismatch');
  }
  if (rows[0].period !== '1952Q1' || rows.at(-1).period !== input.data_through) throw new Error('Input coverage mismatch');
  const n = rows.length, tMean = (n - 1) / 8;
  const log = rows.map(r => Math.log(Number(r.buffett_indicator_pct)));
  const logMean = log.reduce((sum, x) => sum + x, 0) / n;
  let xy = 0, xx = 0;
  for (let i = 0; i < n; i++) { const t = i / 4 - tMean; xy += t * (log[i] - logMean); xx += t * t; }
  const b = xy / xx, a = logMean - b * tMean;
  const residual = log.map((x, i) => x - a - b * i / 4);
  const sigma = Math.sqrt(residual.reduce((sum, x) => sum + x * x, 0) / (n - 2));
  if (!(sigma > 0)) throw new Error('Degenerate model');
  return { n, a, b_per_year: b, sigma_log: sigma, sigma_ddof: 2, rows: rows.map((row, i) => ({
    period: row.period, period_end: row.period_end, bi_pct: Number(row.buffett_indicator_pct),
    trend_pct: Math.exp(a + b * i / 4), deviation_pct: Math.expm1(residual[i]) * 100,
    z_score: residual[i] / sigma, historical_estimate: i < 179,
  })) };
}
