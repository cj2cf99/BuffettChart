# 长期指标页

页面与 Cloudflare 首页导航改名“长期指标”，保留 /buffett/ 原地址。锚点为 #buffett、#sp500、#nikkei225。已有巴菲特两图保留，新增 SP500 Historical 与 Detrended；日经区块明确标为待补真实数据，无图表与读数。

## 标普500

原始交接包 SP500_Nikkei225_Codex_Handoff_20261028.zip 保存在 archive。内含原始 Detrended_Reproducible.zip，其登记 SHA-256 为 9fb8940706694713e804fe7d330dcd5eb6338bc916734ad51e8d56ae46b8d321，已核验。本次无联网行情刷新。

固定 CSV：data/sp500/fixed/spx-v1.csv，SHA-256 39b0b493e846afee31146aa1c4654668eb04462a1a18fa6be86afb1416a60c60。连续835个月，1957-03—2026-09；Multpl/Shiller 名义月均价格，不含股息、未扣通胀，排除当日即时报价。

独立拟合 ln(P)=a+b*t，t=月份序号/12；σ=sqrt(SSE/(n−2))。价格图为新增线性纵轴版本，单位点位；去趋势=(P/Trend−1)×100，Z=ln(P/Trend)/σ。两图共享标普全历史模型，不与巴菲特混用。已有835行原计算表逐行比对误差小于1e-8，参数误差小于1e-12。

末期价格7691.1，趋势4952.632115936163，偏离+55.29318188710668%，Z=+1.5429820594504366。数据截至2026-09-30，原快照核验日2026-10-07；迁移与新增绘图没有重置核验日。a=3.547017709523559，b=0.07137635604760299/年，sigma_log=0.28525583797630233。

原Python绘图入口在副本尝试运行，因环境缺matplotlib未完成。正式页面使用已核验的独立JavaScript模型与SVG渲染复现去趋势，并新增长期价格图；没有声称重新运行原Python包成功或PNG字节相同。

## 独立配置与更新

data/indicators.json 登记三个指标状态。巴菲特最近8季更新；标普最近24个月更新，两者均为约两年。标普固定前缀1957-03—2024-09共811月，更新窗口2024-10—2026-09共24月。新增月将最早一月追加为固定片段，不改旧文件。

标普来源入口 data/sp500/updates/current.json，独立快照 snapshots/、修订 audit/、固定扩展 fixed/extensions/。旧文件不覆盖；修订需用户采纳与原因；只接收完整月均价格，不接收尚未结束月份或月末/当日报价替换。

```sh
# 候选 rows 为 [{"period":"YYYY-MM","price":数值}]；另有新 snapshot_id、updated_on、source_note
npm run sp500:update -- candidate.json
# 预览修订后，由用户决定是否采纳
npm run sp500:update -- candidate.json --apply --accept-revisions
# 仅新增月可省略 --accept-revisions
npm run build
npm test
npm run integrate -- G:/cloudflare/myapp
```

revision_reason 在修订采纳时必填。数据不变不生成新版本、不刷新日期。增量发布共用 package:update；标普近期修订只改 sp500/updates 下两个JSON，老历史、巴菲特数据、页面框架保持不变。

两个指标独立显示更新日期、月/季范围、末值与五个月超期提示，Asia/Shanghai日历规则相同，当前从2027-03-08开始提示。某一指标读取失败不会阻塞另一个。浏览器下载各自两张SVG和完整快照。

公开标普仅 sp500/fixed/history.<hash>.json、以后 YYYY-MM.<hash>.json，以及 sp500/updates/current.json 和 recent.json。哈希固定文件私有长缓存，更新区重新验证；源CSV、审计、归档不发布。公共脚本在共享 fixed/ 下带哈希，四图SVG标题ID唯一。

## 日经225

仅预留用户界面锚点和配置状态。没有确认来源、起点或频率，不复制标普模型，不把gold.csv或短期日报当长期历史。以后取得真实数据、登记月均/月末和来源版本后再接入独立模型。

本轮未部署生产、未改变 Access/D1/KV；Cloudflare接入仍为本地代码变更。
