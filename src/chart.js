const colors = { '-2': '#2e7951', '-1': '#8abb77', '0': '#818b95', '1': '#df8b25', '2': '#c64b4b' };
const fmt = (v, signed = false) => `${signed && v > 0 ? '+' : ''}${v.toFixed(2)}`;
export function renderChart(model,current,detrended) {
  const last=model.rows.at(-1),monthly=current.frequency==='monthly',unit=monthly&&!detrended?'':'%',prefix=monthly?'sp500-':'';
  const width = 1160, height = 420, left = 64, right = 1030, top = 40, bottom = 355;
  const vals = model.rows.map(row => detrended ? row.deviation_pct : row.bi_pct);
  const bands = [-2,-1,0,1,2].map(k => model.rows.map(row => detrended ? Math.expm1(k * model.sigma_log) * 100 : row.trend_pct * Math.exp(k * model.sigma_log)));
  const step=monthly&&!detrended?2000:50;
  const max = Math.ceil(Math.max(...vals, ...bands.flat()) / step) * step;
  const min = detrended ? Math.floor(Math.min(...vals, ...bands.flat()) / 50) * 50 : 0;
  const x = i => left + i / (model.n - 1) * (right - left);
  const y = v => bottom - (v - min) / (max - min) * (bottom - top);
  const line = v => v.map((value, i) => `${i ? 'L' : 'M'}${x(i).toFixed(2)},${y(value).toFixed(2)}`).join(' ');
  const title = monthly?(detrended?'标普 500 去趋势':'标普 500 长期价格'):detrended ? '去趋势巴菲特指数' : '标准巴菲特指数';
  const desc = `${model.rows[0].period} 至 ${last.period}，共 ${model.n} ${monthly?"月":"季"}；末值 ${fmt(vals.at(-1), detrended)}${unit}。两图共用该指标全历史趋势与对数残差标准差。`;
  let out = `<svg xmlns="http://www.w3.org/2000/svg" class="chart" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="${prefix}${detrended ? 'd' : 'h'}-title ${prefix}${detrended ? 'd' : 'h'}-desc"><title id="${prefix}${detrended ? 'd' : 'h'}-title">${title}</title><desc id="${prefix}${detrended ? 'd' : 'h'}-desc">${desc}</desc><rect width="${width}" height="${height}" fill="white"/><g font-family="Segoe UI,Microsoft YaHei,sans-serif">`;
  if(!monthly) out += `<rect x="${left}" y="${top}" width="${x(179)-left}" height="${bottom-top}" fill="#f1f3f5"/><text x="${left+12}" y="${top+18}" font-size="10" fill="#7b8794">冻结历史估计 · 1952Q1—1996Q3</text>`;
  for (let tick = min; tick <= max; tick += step) out += `<line x1="${left}" x2="${right}" y1="${y(tick)}" y2="${y(tick)}" stroke="#e7ecef"/><text x="${left-12}" y="${y(tick)+4}" text-anchor="end" font-size="11" fill="#718091">${tick}${unit}</text>`;
  for (const year of (monthly?[1960,1970,1980,1990,2000,2010,2020]:[1952,1960,1970,1980,1990,2000,2010,2020])) {
    const xx = x(monthly?(year-1957)*12-2:(year-1952)*4);
    out += `<text x="${xx}" y="${bottom+25}" text-anchor="middle" font-size="11" fill="#718091">${year}</text>`;
  }
  out += `<text x="${right}" y="${bottom+25}" text-anchor="middle" font-size="11" fill="#718091">${last.period}</text>${monthly?'':`<line x1="${x(179)}" x2="${x(179)}" y1="${top}" y2="${bottom}" stroke="#b3bdc5" stroke-dasharray="3 4"/>`}`;
  for (const [index,k] of [-2,-1,0,1,2].entries()) out += `<path d="${line(bands[index])}" fill="none" stroke="${colors[k]}" stroke-width="${k===0?1.7:1.3}" stroke-dasharray="6 5"/>`;
  out += `<path d="${line(vals)}" fill="none" stroke="#2b6fc1" stroke-width="2.4" stroke-linejoin="round"/><circle cx="${right}" cy="${y(vals.at(-1))}" r="4" fill="#2b6fc1" stroke="white" stroke-width="2"/>`;
  // End labels are arranged to avoid collisions while retaining short connectors.
  const labels = [-2,-1,0,1,2].map((k,i) => ({ value: bands[i].at(-1), color: colors[k], text: k === 0 ? (detrended ? '0% 趋势' : `${fmt(last.trend_pct)}${unit}`) : `${k>0?'+':''}${k}σ` }));
  labels.push({ value: vals.at(-1), color: '#2b6fc1', text: `${fmt(vals.at(-1), detrended)}${unit}`, bold: true });
  labels.sort((a,b) => b.value-a.value);
  for (const [i,label] of labels.entries()) label.labelY = Math.max(y(label.value), i ? labels[i-1].labelY+19 : top+5);
  const excess = labels.at(-1).labelY-bottom;
  if (excess>0) for (const label of labels) label.labelY-=excess;
  for (const label of labels) out += `<path d="M${right+3},${y(label.value)} L${right+14},${label.labelY} H${right+21}" fill="none" stroke="${label.color}" stroke-width="1"/><text x="${right+27}" y="${label.labelY+4}" font-size="${label.bold?13:11}" font-weight="${label.bold?700:400}" fill="${label.color}">${label.text}</text>`;
  out += `<text x="${left}" y="${height-12}" font-size="10" fill="#718091">${monthly?"Multpl / Shiller · 月均价格（点）":"Fed / FRED · 季度数据"} · 观测截至 ${last.period} · 快照 ${current.updated_on}</text></g></svg>`;
  return out;
}
