# 长期指标页

页面与 Cloudflare 首页导航名称为“长期指标”，保留 /buffett/ 原地址。锚点为 #buffett、#sp500、#nikkei225。现包含巴菲特、标普 500 与日经 225 三个独立指标；每个指标均提供标准价格和去趋势两图。页面缩略预览小于全图高度的四分之一，点击后在弹窗中查看详细图表。

## 更新提醒

所有日期按 Asia/Shanghai 日历日计算，构建不会重置数据日期。巴菲特数据每 6 个月更新一次，在期限前 30 天开始提醒；标普 500 与日经 225每 2 个月更新一次，在期限前 14 天开始提醒。未进入提醒窗口时隐藏状态栏；到期日当天及之后显示“需要更新”。下载或数据读取错误仍单独显示错误状态。

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

三个指标独立显示数据范围和末值。巴菲特每6个月更新、期限前30天开始提醒；标普500和日经225每2个月更新、期限前14天开始提醒。仅在进入提醒窗口或逾期时显示更新状态；某一指标读取失败不会阻塞另一个。浏览器下载各自两张SVG和完整快照。

公开标普仅 sp500/fixed/history.<hash>.json、以后 YYYY-MM.<hash>.json，以及 sp500/updates/current.json 和 recent.json。哈希固定文件私有长缓存，更新区重新验证；源CSV、审计、归档不发布。公共脚本在共享 fixed/ 下带哈希，四图SVG标题ID唯一。

## 日经225

接入来源为 ECB Data Portal 提供的 DataStream 序列 `FM.M.JP.JPY.DS.EI.JAPDOWA.HSTA`，定义为日经 225 历史收盘值的期间观测平均，月频、日元点位。下载源文件整理为 `data/nikkei225/monthly_average.csv`，SHA-256 为 `e870808c182ed9e2bfd64ff0402b61d83422f04c7dd04c2d2a3ab32d54dcf131`，647 个连续月份，1972-11—2026-09；捕获日期 2026-10-28。名义价格，不含股息或通胀调整。

日经序列拥有独立全历史对数 OLS 模型，`t=月序号/12`，残差标准差自由度 `n−2`。不与标普或巴菲特共用参数。FRED 日收盘、官方月度 OHLC、来源差异文件均留在本地归档核对；没有拼接到页面主序列。1972-11 以前的全交易日月均仍未建立。

ECB 的序列元数据将数据提供方列为 DataStream。ECB 的公开统计再利用政策明确排除未经原始权利人许可的第三方数据；因此这个接入保留来源与使用限制说明，仅供当前受访问控制的个人工作台使用，不应公开再分发或开放站点访问，除非另行取得所需许可。

本轮未部署生产、未改变 Access/D1/KV；Cloudflare接入仍为本地代码变更。
