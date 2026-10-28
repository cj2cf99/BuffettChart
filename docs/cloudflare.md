# BuffettChart 接入个人工作台

## 页面与资产

首页卡片及全站导航进入 `/buffett/`；`/buffett` 301 到带尾斜杠路径并保留查询参数。标准指数和去趋势指数共享 298 季冻结输入及同一长期模型。公开快照和两张 SVG 可下载。

复用现有 `public/` 的 `STOCKCHECK_ASSETS` 绑定，保留 `run_worker_first=true`、`html_handling=none`、`not_found_handling=none`。新路由只处理 `/buffett` 和 `/buffett/` 前缀，且只接受 GET/HEAD；目录首页显式映射 index.html。未知资源与源代码路径返回 404。

白名单仅为 index.html、style.css、app.js、freshness.js、snapshot.json、historical.svg、detrended.svg。现有 Worker 仍在资产之前运行，沿用站点入口的 Access 配置；本次不改变权限。资源响应添加同源 CSP、nosniff、SAMEORIGIN，缓存为 private 且每次重新验证。

参考 Cloudflare 官方静态资产绑定说明：https://developers.cloudflare.com/workers/static-assets/binding/ 。现有绑定名称虽然包含 stockcheck，但其目录为整个 public/，可以直接复用。

## 数据新鲜度

观测期：2026Q2（季度结束日 2026-06-30）。快照核验/更新日：2026-10-07。网页构建日期不用于判断数据新鲜度。

超过五个日历月提示更新，Asia/Shanghai 日期比较。当前阈值 2027-03-07，2027-03-08 起警告。浏览器每分钟及切回页面重新检查。无 JavaScript 时显示核查期限。提醒属于展示，不自动抓取或采纳修订。

## 更新

来源仓库：https://github.com/cj2cf99/BuffettChart 。在来源项目运行：

```sh
npm run build
npm test
npm run integrate -- G:/cloudflare/myapp
```

再在 myapp 中运行 `npm test`、`npm run check`。重复导入相同内容不改写资产。source-manifest.json 记录输入版本和公开资产哈希，集成测试核对文件字节。

## 边界与代码所有权

BuffettChart 维护模型、输入、页面、静态输出及源路由模板。myapp 维护入口与集成后的路由。不要手改 public/buffett 的派生文件；应修改来源后重新构建/导入。

本功能不新增 API、D1 表、迁移、KV 键、联网行情请求或计划任务。设计文档和原始迁移包不发布为网站资产。

Git 提交不等于线上发布。本次完成接入代码及静态内容后，正式 Cloudflare 部署仍沿用 myapp 的既有发布流程。
