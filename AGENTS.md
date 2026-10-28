# BuffettChart 维护约定

- 当前页面已扩展为“长期指标”，URL 仍为 /buffett/。保留巴菲特两图，新增 SP500 月均价格与去趋势两图；日经225仅预留位置，禁止用模拟数据填充。
- SP500 数据、模型和日期独立，起点1957-03；最近24个月更新区，不套用季度频率、179季估计段或巴菲特系数。详情见 docs/long-term-indicators.md。此要求覆盖下文旧“仅两图”描述。

- 阅读 README.md 与 docs/cloudflare.md。正式网页为 /buffett/ 下标准和去趋势两图。
- 最新结构要求：固定区 + 滚动最近 8 季更新区；该要求优先于 archive 中原三图交付和“当前有效全 298 行不采纳修订”的旧流程。原始完整 v1 文件仍永久保留，不覆盖。
- data/fixed/baseline-v1.json 哈希写死；固定历史不得改写。新增季度仅追加固定片段，将更新区维持 8 季。
- 近期修订先生成差异；用户决定采纳后才可使用 --accept-revisions --apply。优化结构或测试不授权采纳实际新数据。
- data/updates/snapshots 与 audit 的旧文件不覆盖；current.json 为唯一当前源入口。数据不变不刷新 updated_on。
- 构建和导入必须按字节比较，不改变未变化文件的 mtime。禁止重新打包整段老历史作为日常更新。
- 只发布 publication.json 引用的公开文件。固定发布文件带内容哈希，代码升级产生新文件名；不要修改原路径字节。
- 修改后 npm run build、npm test。向 myapp 导入后在 myapp 执行 npm test、npm run check。
- 不自动部署 Cloudflare，不改 Access/D1/KV。GitHub 来源仓库同步不隐含 Cloudflare 仓库推送。
