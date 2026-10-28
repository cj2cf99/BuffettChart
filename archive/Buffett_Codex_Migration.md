# 巴菲特指数：Codex 桌面版迁移交接

整理日期：2026-10-28。依据：2026-10-07 定稿 v2 指示书、project_config.json、Drive 当前项目状态、冻结数据和原始代码。本次是项目整理与离线复现，没有刷新市场数据。冻结数据截至 2026Q2，不代表 2026-10-28 的实时估值。

## 1. 先知道这些

- 当前正式成果为美国季度巴菲特指数三图：Historical、Detrended、Recent 10Y Quarterly。
- 数据覆盖 1952Q1—2026Q2，共 298 季；近期图为 2016Q3—2026Q2，共 40 季。
- 最近 40 季只截取长期模型，不重新拟合短期趋势或标准差。
- 1952Q1—1996Q3 为 179 个永久冻结的历史估计点；其后 119 个点为官方原值经算术派生。现有 298 行全部保留为固定 v1。
- 所谓“归一化后的图”，在最终规范中对应去趋势百分比；Z-score 是另一个无量纲标准化值，两者不能混称。
- 早期的 5 年月频、20 月均线、20 月 Z-score 已被最终 v2 覆盖。不得根据旧文件名恢复它们。

## 2. 数据和代码在哪里

主目录：[Google Drive / Buffett_Indicator](https://drive.google.com/drive/folders/1TIHcsBqDkVMLjXQiwnLk42LDI3tpw_w5)。本次已读取目录；最后登记的正式状态为 THREE_CHARTS_COMPLETE。

| 内容 | 文件名 | Drive ID |
|---|---|---|
| 最终口径 | Buffett_AI_Generation_Guide.md | 1czpp5MOYhlb8JvLrqi5U_5aH2nj8Ty7T |
| 最终状态入口 | Buffett_Project_State_v2.json | 1RvzahG-p0XCHKUwLMS3zdtXaIA4_xiA2 |
| 正式数据 | Buffett_Quarterly_Frozen_v1.json | 1178kx3g3TQ7UpBzlcFL1C8jK8IOF8REJ |
| 初始冻结状态 | Buffett_Cache_State_v1.json | 1ObkAgef62_Leo5FwucIzHDcm79ZpYgXV |
| 数据口径说明 | README_Buffett_Frozen.md | 1YGDJiAuOoaD9eC6eq6sezzzo1uVzYKjW |
| 原始 CSV、构建与审计代码 | Buffett_Frozen_Baseline_20261007.zip | 1lDWFz9wLspng8DsgaGW-wmo-gEfhSgAL |
| 三图、绘图代码、固定输入 | Buffett_Project_v2_Package.zip | 1GxIhyRNs45-OBwdL47zWa46N_hPJCTiC |
| 三页参考 PDF | Buffett_Three_Charts.pdf | 1Gu2h1-A74qXbxMW-Ddh9grOugn7Urklu |
| 全历史 PNG | Buffett_Historical.png | 10nPwxwMM4qaEZsbdGJf7bi8OAUShanPC |
| 去趋势 PNG | Buffett_Detrended.png | 19Ft2hc8701gXS55PGZPUcpZ_Dr6m5dYl |
| 近期 PNG | Buffett_Recent_10Y_Quarterly.png | 1YWhXIK3uXde9pO5jxaUUse5YDF22QIVs |

本迁移包包含上述两个原始 ZIP、解压后的完整绘图项目，以及读取到的两个状态文件。原始 CSV 位于基线 ZIP 的 Buffett_Frozen_Baseline/raw/。绘图项目的 input_frozen.json 与正式 JSON 字节一致。

数据 SHA-256：

```text
811a45df3978d0e4e41d85012a737683014f5eba579ba5584a92536e2af68b1a
```

目录内旧 Project_Scope_20261007.json、Recent_Chart_State_v1.json、Recent_5Y 文件是过程产物。初始状态和 README 中“最终图为 0／未生成最终图”也是早期状态，已被 v2 完成状态覆盖；不能据此认定三图未做。

## 3. 数据源、字段与单位

| 数据 | FRED 系列 | 保存单位 / 用途 |
|---|---|---|
| 公开企业股权 public | BOGZ1LM883164115Q | 百万美元，1996Q4 起市值基础 |
| 企业股权总额 total | BOGZ1LM883164105Q | 百万美元，早期估计基础 |
| ETF | BOGZ1FL564090005Q | 百万美元，扣除项 |
| 封闭式基金 closed_end | BOGZ1FL554090005Q | 百万美元，扣除项 |
| 名义 GDP | GDP | 十亿美元，季调年率 SAAR |

这些是既有项目登记的数据源，本次没有联网重取或审核其最新发布。源链接及原始 CSV 哈希保存在数据根节点 sources 中。

JSON 根节点包括 snapshot_id、captured_on、frequency、data_through、historical_model、update_policy、sources、rows。

| 行字段 | 含义 |
|---|---|
| period | 如 2026Q2，季度业务键 |
| quarter_label | 如 2026-04-01，季度首日标签 |
| period_end | 如 2026-06-30，季度末 |
| market_cap_usd_million | 派生市值，百万美元，十进制字符串 |
| gdp_usd_billion_saar | GDP，十亿美元 SAAR，十进制字符串 |
| buffett_indicator_pct | 指数百分数数值，如 238.4258，而非 2.384258 |
| quality | 历史估计或官方派生质量标签 |
| is_fitted / is_interpolated / frozen | 数据整理标记；不是趋势回归标记 |
| source_values | 当时捕获的各系列官方原始值 |

quarter_label 与 period_end 属于同一季度，不代表分别有两条观测。季度数据不得复制三次冒充独立月度数据。正式市场口径是 Fed 国内公开企业股权扣 ETF 和封闭式基金；不承诺等同交易所逐家公司汇总或 Wilshire。

## 4. 原始巴菲特指数怎么算

1996Q4 起：

```text
market_cap = public - ETF - closed_end
BI_pct = market_cap_usd_million / 1000 / gdp_usd_billion_saar * 100
```

GDP 已经年率化，不能再乘 4。分子与分母必须对应同一季度。

1952Q1—1996Q3：

```text
c = 0.8877238600607575316245036745057902296845
market_cap = (total - ETF - closed_end) * c
```

c 来自 1996Q4—2001Q3 共 20 季 `(public-ETF-closed_end)/(total-ETF-closed_end)` 的中位数。该系数和早期 179 行永久冻结，不重新校准。quality 为 HISTORICAL_ESTIMATE_FROZEN、is_fitted=true；1996Q4 起为 FED_OFFICIAL_DERIVED、is_fitted=false。早期估计不是实际观测的上市总市值。

2026Q2 算例：

```text
public = 93,607,725
ETF = 15,702,340
closed_end = 266,715
market_cap = 77,638,670 百万美元
GDP = 32,563.030 十亿美元 SAAR
BI_pct = 238.42581602510577%
```

## 5. 长期趋势、去趋势和标准化

对全部 298 季拟合一次长期模型。t 为距 1952Q1 的年数，第一期为 0，每季增加 0.25。

```python
import numpy as np
t = np.arange(len(BI_pct)) / 4
b, a = np.polyfit(t, np.log(BI_pct), 1)
trend_pct = np.exp(a + b*t)
residual = np.log(BI_pct) - (a + b*t)
sigma_log = np.sqrt(np.sum(residual**2) / (len(BI_pct)-2))
deviation_pct = np.expm1(residual) * 100
z_score = residual / sigma_log
```

趋势带：`trend_pct * exp(k*sigma_log)`，k 为 -2、-1、+1、+2。

去趋势图水平带：`expm1(k*sigma_log)*100`。正负带换算为百分比后不对称，这是定义本身的结果。sigma 使用回归残差平方和除以 n−2，不能改用 ddof=0 或 1。

| 表达 | 公式 | 趋势基准 | 当前冻结值 |
|---|---|---|---:|
| 标准／原始 BI | 市值 / GDP × 100 | 长期趋势线随时间变化 | 238.425816% |
| 去趋势百分比（最终第二图） | (BI / Trend − 1) × 100 | 0% | +65.930183% |
| Z-score（标准化对数残差） | ln(BI / Trend) / sigma_log | 0 | +1.495685 |
| 相对趋势基数 100（仅概念换算） | BI / Trend × 100 | 100 | 165.930183 |

基数 100 版本不是既有正式输出；若用户以后明确要求可单独增加，不能替换最终三图。Z-score 当前用于摘要和逐期数据，也没有独立的正式第四图。这里的去趋势不是 min-max，也不是 BI 减去全样本均值。不能用 deviation_pct/sigma_log 计算 Z。

参考参数：

| 参数 | 值 |
|---|---:|
| n | 298 |
| a | 3.7517877600036833 |
| b（每年） | 0.016375401068659763 |
| sigma_log | 0.3385719898464284 |
| 2026Q2 Trend | 143.6904437312909% |
| 去趋势 -2σ | -49.19340310479165% |
| 去趋势 -1σ | -28.721253591825597% |
| 去趋势 +1σ | +40.29427429510991% |
| 去趋势 +2σ | +96.82483399991537% |

这是当前全样本回归；未来新增季度后全历史趋势与偏离值会变动，即使基础旧数据完全不动。它不是各历史时点仅使用当时信息的实时回测。σ 带表示对数残差离散程度，不是置信区间、预测区间或风险概率；没有按 CMV 的读数反向校准。

## 6. 三种正式图怎么画

| 图 | 横轴 / 窗口 | 主线 | 趋势与带 | 输出名 |
|---|---|---|---|---|
| Historical | 全部季度，1952Q1—2026Q2 | BI_pct | Trend 与 Trend×exp(±1σ/±2σ) | Buffett_Historical |
| Detrended | 同一完整区间 | deviation_pct | 0% 与 expm1(±1σ/±2σ)×100 | Buffett_Detrended |
| Recent 10Y Quarterly | 最后 40 个连续季度 | BI_pct[-40:] | 同一长期模型的最后 40 点 | Buffett_Recent_10Y_Quarterly |

原始及近期图纵轴 Market Value/GDP (%)；去趋势图纵轴 Deviation from exponential trend (%)。逐季绘制，不按年聚合。近期图不能只用 40 点重新估 a、b 或 σ。

既有样式：白底，15×7.6 英寸，PNG 180dpi，PDF 矢量；图表英文，交接说明中文。蓝色 #2b6fc1 为数据，灰色 #818b95 虚线为趋势/0%，+1σ 橙 #df8b25、+2σ 红 #c64b4b、-1σ 浅绿 #8abb77、-2σ 深绿 #2e7951，均虚线。

全历史两图以浅灰背景标示 1996Q4 前估计段，并画分界线；近期图不包含估计点。顶部摘要显示最新 BI、趋势、Z；去趋势图显示偏离和 Z。底部注明来源、市场定义、估计段及 σ 含义。图例在数据区下方，右侧为最新点标签预留空间；坐标范围覆盖全部主线和带。

交付顺序固定：Historical → Detrended → Recent。每图 PNG/PDF 各一份，再合并三页 Buffett_Three_Charts.pdf。保存逐期值、模型参数、输入版本及校验结果。

## 7. 桌面版如何接手与运行

解压本迁移包，在 Codex 桌面版中打开解压目录。先读本文件及 START_HERE.txt，再读 source/Buffett_Project_v2/Buffett_AI_Generation_Guide.md 和 project_config.json。无需先连 Drive 就可以复现；联网更新另行实现。

建议先复制 source/Buffett_Project_v2 到 work/Buffett_Project_v2，保留 source 原件。以下命令在复制出的绘图目录执行，Windows 可使用 py，macOS/Linux 可使用 python3：

```bash
python -m venv .venv
# Windows PowerShell: .venv\Scripts\Activate.ps1
# macOS/Linux: source .venv/bin/activate
python -m pip install numpy matplotlib pypdf Pillow
python load_frozen.py input_frozen.json
python generate_all.py
```

若环境未提供 python 命令，使用 py 或 python3 替代。依赖未锁版本；字节一致的 PNG 已在本次环境验证，其他字体或库版本下优先比较计算值和图表内容，不强求 PDF 文件哈希一致。

| 程序 / 文件 | 作用 |
|---|---|
| generate_all.py | 离线运行两套绘图脚本、合并三页 PDF、验证共享模型与图像解码 |
| generate_charts.py | 全历史、去趋势、chart_metrics.json、chart_values.json |
| generate_recent_10y.py | 最近 40 季、recent_chart_values.json |
| load_frozen.py | 固定输入 SHA-256 检查，禁止官方段含拟合点 |
| project_config.json | 现行 v2 范围、参数与更新策略声明 |
| verification_v2.json | 三图完成、共享模型、输入保护等既有检查结果 |
| 基线包 build_baseline.py | 离线审计原始基线，不是日常刷新入口 |
| 基线包 verify_baseline.py | 对原始输入和基线作审计验证 |

实际限制：原程序可直接复现固定 v1，含 len(y)==298、固定首尾季度、固定标题和坐标范围等写死值。project_config.json 主要用于规范声明，脚本并未完整按配置驱动；load_frozen.py 也写死 v1 哈希。在线缓存编排、Drive 下载上传、增量抓取、修订处理和定时任务均未实现。不得把“离线复现成功”说成“自动更新已部署”。

将来更新时先改成版本化输入与动态日期、期数、标题、轴范围及一致的共享模型，再新增联网层；保留 v1 复现路径。原近期脚本另行用全历史重算同一模型后校验参数相同，数学口径符合规范，但代码尚未抽取公共模型函数。

## 8. 缓存与后续更新规则

1. 查看时先读取最终规范与状态。距三图上次生成不超过一个日历月且无强制更新/改版要求时，直接使用缓存。日历月按 Asia/Shanghai 计算，不机械等同 30 天。
2. 超过一个月再检查官方最新共同季度及同季度发布版本。未变化继续缓存并记录检查日期。
3. 新季度必须取得全部同季度官方输入，使用最近完整共同季度，不补造尚缺数据的季度。记录观测期、捕获时间、发布信息与来源。
4. v1 JSON 和已有 298 行不覆盖。新季度只能存为独立新快照并追加，逐行比较旧数据。
5. 1952Q1—1996Q3 在所有版本中永远保持原值和原系数。近期官方修订先另存差异，不静默替换；用户决定采纳后另建有明确修订说明的新版本。
6. 重新拟合长期趋势只生成派生值，不改基础观测。三图同时使用同一输入版本及模型。
7. 全部校验与保存成功后才更新 generated_at、data_through、snapshot、输出 ID/哈希。失败保留旧成功状态并记录失败原因。

本次未检查官方新增发布、未刷新 v1、未部署后台任务、网站或邮件。项目原先的 Drive 基础读写测试不等于跨会话、后台、并发及故障恢复全部通过。

## 9. 本次迁移验收与后续验收

2026-10-28 在副本运行原始 generate_all.py 通过；正式输入 SHA-256 正确；298 季；模型参数与上表一致；近期恰好 40 季且官方段无拟合点；PNG 可解码；合并 PDF 三页。三张重新生成的 PNG 哈希与原存档全部相同。复跑结果存于 verification/。原始项目与两个原始 ZIP 保留未改。

| PNG | SHA-256 |
|---|---|
| Buffett_Historical.png | 3519560effe2d0478cb77b98133bf14e3c7d9ff713f42a62e62373a470adf986 |
| Buffett_Detrended.png | fd30310c6cf31e3dd8aee7544ce1409570e6d13bd55f1c2468ff142716e43ab2 |
| Buffett_Recent_10Y_Quarterly.png | 16b02f510319798223767c568bc152a0d6fc85394165e9f65f605ae148a2420d |

未来改动还应检查 period 唯一连续、GDP/市值为正、无缺失、原始值不被覆盖、历史估计标记和分界正确、OLS 残差均值约 0 且与时间正交、去趋势反算可恢复 BI、三图模型一致、最新点一致、图例及末值标签不裁切。原脚本已有部分断言，不能把规范清单视为全部已自动实现。

## 10. 先前讨论中未纳入最终版的内容

| 内容 | 迁移时如何处理 |
|---|---|
| 1947 起点 | 已改为 1952Q1，不恢复不完整历史 |
| 5 年月频、20M rolling mean/σ/Z | 已由季度 40 点近期图覆盖，不默认恢复 |
| 用偏离百分比的普通标准差替代 log residual σ | 只是建议，未采纳 |
| 修正指标 TMC/(GDP+Fed Assets) | 之前讨论过的另一指标，不是 v2 的正式三图输入；没有本包对应的正式连续序列或生成流程 |
| CMV / Wilshire / GuruFocus / Siblis 等 | 参考或对照候选，不混入正式固定输入，不按参考图强行缩放 |
| 标普/黄金去趋势图 | 独立项目，本次未混入巴菲特指数包 |

本交接只恢复已确认范围；新增图、口径或数据修订需要明确登记新规范和版本。
