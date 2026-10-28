# BuffettChart 维护约定

- 正式网页仅显示标准和去趋势两图，挂载在 `/buffett/`。
- 开始改动前阅读 README.md、docs/cloudflare.md。原迁移规范保存在 archive/，网站两图及五个月提示要求优先于归档中的旧三图交付要求。
- 不修改固定 v1 JSON 或其历史估计系数；新增季度/官方修订必须采用独立版本，修订采纳由用户决定。
- 数据更新日来自数据快照核验日，不得因构建、改样式、提交或部署而刷新。
- 修改后运行 npm run build 和 npm test。向 myapp 导入后在 myapp 运行 npm test、npm run check。
- 仅 dist/ 内白名单文件部署；不公开 archive/、data/、测试或 Git 文件。
- Git 同步不隐含正式 Cloudflare 部署。无用户明确要求时不部署，不改变 Access、D1 或 KV。
