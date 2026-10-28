# BuffettChart 接入个人工作台

当前入口名称为“长期指标”，地址仍 /buffett/。新增独立 SP500 月度两图与日经225预留位；新增公开前缀 sp500/fixed/（哈希历史片段）和 sp500/updates/{current,recent}.json。共享 fixed/ 另有哈希 sp500 与 sp500-app 脚本。缓存及只读边界与下文一致；详见 [长期指标说明](long-term-indicators.md)。下文原“两图”专指巴菲特区块。

`/buffett/` 为独立只读二级页，首页与全站导航可进入；`/buffett` 保留查询参数并 301 到带尾斜杠路径。顶部展示末期数值，正文两张全历史 SVG；浏览器用固定历史和近期数据生成图表和下载文件。

## 公开文件与缓存

| 路径 | 含义 | Cache-Control |
| --- | --- | --- |
| `index.html` | 稳定页面框架，只随界面版本改变 | private, max-age=0, must-revalidate |
| `fixed/history.<hash>.json` | 固定历史基础序列与原来源信息 | private, max-age=31536000, immutable |
| `fixed/YYYYQn.<hash>.json` | 以后逐季转入的固定片段 | 同上 |
| `fixed/{app,chart,series,freshness}.<hash>.js` | 界面、绘图、校验与日期代码 | 同上 |
| `fixed/style.<hash>.css` | 样式 | 同上 |
| `updates/recent.json` | 最近 8 季数字，当前 2024Q3—2026Q2 | private, max-age=0, must-revalidate |
| `updates/current.json` | 模型、末值、日期和分区哈希 | 同上 |

只允许上述命名模式和 GET/HEAD；不提供 SPA 兜底。原始基线、源快照版本、审计记录、archive、docs、data 和 Git 目录均不能经该路由读取。资源依旧先进入 Worker，复用 `STOCKCHECK_ASSETS` / public/ 和 `run_worker_first=true`，不改变 Access。浏览器长缓存仅为 private，Shared CDN 不公开缓存私人站点内容。

官方资产与自定义 Worker 响应头规则参考：https://developers.cloudflare.com/workers/static-assets/headers/ 。缓存策略由本功能的路由处理器显式设置。

## 更新与兼容迁移

来源：https://github.com/cj2cf99/BuffettChart 。在来源项目更新候选数据、执行 `npm run build`、`npm test`，然后执行 `npm run integrate -- G:/cloudflare/myapp`。myapp 运行 `npm test`、`npm run check`。

导入脚本验证 publication.json 与全部内容的哈希，只改写变化文件。固定资源同名而内容不同会拒绝；相同数据重导入不改写文件。source-manifest.json 登记当前引用文件、分区、大小与 SHA-256。

首次 v1→v2 迁移时，仅移除旧清单登记的 6 个生成文件（根 app.js/freshness.js/style.css、两张 SVG 和完整 snapshot.json），且必须与旧哈希一致。新 HTML 覆盖旧内嵌 SVG 页面。旧固定资源不自动清理，保持此前已打开页面的模块依赖可读；需要清理时另行核查引用和缓存期限。

固定资产先复制，近期数字后复制，current.json 最后切换；正式部署建议用一次完整 Cloudflare 版本切换。浏览器对全部数据片段校验哈希，若部署切换间读到混合版本，会完整重读一次；仍不一致时显示失败与重试入口，不展示混合结果。

## 数据边界

最近 8 季可在用户明确采纳后修订；每次保存独立小快照与前后值审计。新增季度把窗口外最早一季转入独立固定片段，老文件不改写。1952Q1—1996Q3 的估计值与比例以及完整原始 v1 基线永不覆盖。重估趋势可影响全历史派生值，不影响固定原始观测。

本次真实数据仍截至 2026Q2，核验日期 2026-10-07。超过五个日历月（上海时间 2027-03-08 起）提示更新，构建和部署不重置日期。禁用 JavaScript 时页面提示需要脚本，并提供可直接读取的模型和日期 JSON。

不新增 API、D1、KV、后台任务或自动数据抓取。Git 同步和正式部署分开，来源项目不自动部署 Cloudflare。
