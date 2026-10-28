import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { computeModel } from './model.mjs';
import { addCalendarMonths } from '../src/freshness.js';
const root = fileURLToPath(new URL('../', import.meta.url));
const read = p => fs.readFileSync(path.join(root, p));
const manifest = JSON.parse(read('data/manifest.json'));
const bytes = read(`data/${manifest.input_file}`);
const hash = createHash('sha256').update(bytes).digest('hex');
if (hash !== manifest.input_sha256) throw new Error('Input hash mismatch; frozen input must not be changed');
const input = JSON.parse(bytes), model = computeModel(input), last = model.rows.at(-1);
if (manifest.updated_on !== input.captured_on) throw new Error('Update date must reflect input verification, not build time');
if (model.n !== 298 || input.data_through !== '2026Q2') throw new Error('v1 contract mismatch; use a separate version for new quarters');
for (const [key, value] of Object.entries({ a: 3.7517877600036833, b_per_year: 0.016375401068659763, sigma_log: 0.3385719898464284 })) {
  if (Math.abs(model[key] - value) > 1e-12) throw new Error(`Model regression: ${key}`);
}
const colors = { '-2': '#2e7951', '-1': '#8abb77', '0': '#818b95', '1': '#df8b25', '2': '#c64b4b' };
const fmt = (v, signed = false) => `${signed && v > 0 ? '+' : ''}${v.toFixed(2)}`;
const escape = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
function chart(detrended) {
  const width = 1160, height = 420, left = 64, right = 1030, top = 40, bottom = 355;
  const vals = model.rows.map(row => detrended ? row.deviation_pct : row.bi_pct);
  const bands = [-2,-1,0,1,2].map(k => model.rows.map(row => detrended ? Math.expm1(k * model.sigma_log) * 100 : row.trend_pct * Math.exp(k * model.sigma_log)));
  const max = Math.ceil(Math.max(...vals, ...bands.flat()) / 50) * 50;
  const min = detrended ? Math.floor(Math.min(...vals, ...bands.flat()) / 50) * 50 : 0;
  const x = i => left + i / (model.n - 1) * (right - left);
  const y = v => bottom - (v - min) / (max - min) * (bottom - top);
  const line = v => v.map((value, i) => `${i ? 'L' : 'M'}${x(i).toFixed(2)},${y(value).toFixed(2)}`).join(' ');
  const title = detrended ? '去趋势巴菲特指数' : '标准巴菲特指数';
  const desc = `${model.rows[0].period} 至 ${last.period}，共 ${model.n} 季；末值 ${fmt(vals.at(-1), detrended)}%。灰色估计段至 1996Q3；两图共用全历史趋势与对数残差标准差。`;
  let out = `<svg xmlns="http://www.w3.org/2000/svg" class="chart" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="${detrended ? 'd' : 'h'}-title ${detrended ? 'd' : 'h'}-desc"><title id="${detrended ? 'd' : 'h'}-title">${title}</title><desc id="${detrended ? 'd' : 'h'}-desc">${desc}</desc><rect width="${width}" height="${height}" fill="white"/><g font-family="Segoe UI,Microsoft YaHei,sans-serif">`;
  out += `<rect x="${left}" y="${top}" width="${x(179)-left}" height="${bottom-top}" fill="#f1f3f5"/><text x="${left+12}" y="${top+18}" font-size="10" fill="#7b8794">冻结历史估计 · 1952Q1—1996Q3</text>`;
  for (let tick = min; tick <= max; tick += 50) out += `<line x1="${left}" x2="${right}" y1="${y(tick)}" y2="${y(tick)}" stroke="#e7ecef"/><text x="${left-12}" y="${y(tick)+4}" text-anchor="end" font-size="11" fill="#718091">${tick}%</text>`;
  for (const year of [1952,1960,1970,1980,1990,2000,2010,2020]) {
    const xx = x((year-1952)*4);
    out += `<text x="${xx}" y="${bottom+25}" text-anchor="middle" font-size="11" fill="#718091">${year}</text>`;
  }
  out += `<text x="${right}" y="${bottom+25}" text-anchor="middle" font-size="11" fill="#718091">${last.period}</text><line x1="${x(179)}" x2="${x(179)}" y1="${top}" y2="${bottom}" stroke="#b3bdc5" stroke-dasharray="3 4"/>`;
  for (const [index,k] of [-2,-1,0,1,2].entries()) out += `<path d="${line(bands[index])}" fill="none" stroke="${colors[k]}" stroke-width="${k===0?1.7:1.3}" stroke-dasharray="6 5"/>`;
  out += `<path d="${line(vals)}" fill="none" stroke="#2b6fc1" stroke-width="2.4" stroke-linejoin="round"/><circle cx="${right}" cy="${y(vals.at(-1))}" r="4" fill="#2b6fc1" stroke="white" stroke-width="2"/>`;
  // End labels are arranged to avoid collisions while retaining short connectors.
  const labels = [-2,-1,0,1,2].map((k,i) => ({ value: bands[i].at(-1), color: colors[k], text: k === 0 ? (detrended ? '0% 趋势' : `${fmt(last.trend_pct)}%`) : `${k>0?'+':''}${k}σ` }));
  labels.push({ value: vals.at(-1), color: '#2b6fc1', text: `${fmt(vals.at(-1), detrended)}%`, bold: true });
  labels.sort((a,b) => b.value-a.value);
  for (const [i,label] of labels.entries()) label.labelY = Math.max(y(label.value), i ? labels[i-1].labelY+19 : top+5);
  const excess = labels.at(-1).labelY-bottom;
  if (excess>0) for (const label of labels) label.labelY-=excess;
  for (const label of labels) out += `<path d="M${right+3},${y(label.value)} L${right+14},${label.labelY} H${right+21}" fill="none" stroke="${label.color}" stroke-width="1"/><text x="${right+27}" y="${label.labelY+4}" font-size="${label.bold?13:11}" font-weight="${label.bold?700:400}" fill="${label.color}">${label.text}</text>`;
  out += `<text x="${left}" y="${height-12}" font-size="10" fill="#718091">Fed / FRED · 季度数据 · 观测截至 ${last.period} · 快照 ${manifest.updated_on}</text></g></svg>`;
  return out;
}
const historical = chart(false), detrended = chart(true);
const legend = `<div class="legend" aria-label="图例"><span><i class="actual"></i>指数 / 偏离</span><span><i style="--color:#818b95"></i>趋势基准</span>${[-2,-1,1,2].map(k=>`<span><i style="--color:${colors[k]}"></i>${k>0?'+':''}${k}σ</span>`).join('')}</div>`;
const snapshot = { spec_version: 'web-v1', snapshot_id: input.snapshot_id, input_sha256: hash, updated_on: manifest.updated_on,
  data_through: input.data_through, data_through_date: last.period_end, update_warning_months: 5, timezone: 'Asia/Shanghai',
  n: model.n, a: model.a, b_per_year: model.b_per_year, sigma_log: model.sigma_log, sigma_ddof: 2,
  latest: last, rows: model.rows, sources: input.sources };
const substitutions = { PERIOD: last.period, START: model.rows[0].period, COUNT: model.n, UPDATED: manifest.updated_on,
  DUE: addCalendarMonths(manifest.updated_on,5), BI: fmt(last.bi_pct), DEV: fmt(last.deviation_pct,true), TREND: fmt(last.trend_pct),
  Z: fmt(last.z_score,true), END_DATE: last.period_end, SNAPSHOT: input.snapshot_id, HISTORICAL_SVG: historical, DETRENDED_SVG: detrended, LEGEND: legend };
const template = read('src/index.html').toString();
const html = template.replace(/\{\{([A-Z_]+)\}\}/g, (_,key) => {
  if (!(key in substitutions)) throw new Error(`Unknown template key ${key}`);
  return key.endsWith('_SVG') || key==='LEGEND' ? substitutions[key] : escape(substitutions[key]);
});
const dist = path.join(root, 'dist'); fs.mkdirSync(dist, {recursive:true});
const outputs = { 'index.html':html, 'historical.svg':historical, 'detrended.svg':detrended, 'snapshot.json':JSON.stringify(snapshot,null,2)+'\n',
  'app.js':read('src/app.js'), 'freshness.js':read('src/freshness.js'), 'style.css':read('src/style.css') };
for (const [name,body] of Object.entries(outputs)) fs.writeFileSync(path.join(dist,name),body);
const publication = { snapshot_id: input.snapshot_id, updated_on: manifest.updated_on, input_sha256:hash,
  files:Object.keys(outputs).sort().map(name=>({name,sha256:createHash('sha256').update(outputs[name]).digest('hex')})) };
fs.writeFileSync(path.join(root,'publication.json'),JSON.stringify(publication,null,2)+'\n');
console.log(`Built 2 charts / ${model.n} quarters / ${input.data_through}; input verified; update date ${manifest.updated_on}`);
