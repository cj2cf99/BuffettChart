# Buffett Indicator：AI生成指示书

版本：v2；生效日期：2026-10-07。本文与project_config.json是当前任务规范，覆盖此前三图/月频要求、5年预览和取消短期图的临时决定。

## 1. 任务与交付

用户要求同时保留并输出三张图，顺序固定：
1. Historical：1952Q1到最新季度的BI、全历史指数趋势、±1σ/±2σ。
2. Detrended：相同区间与相同模型，展示相对趋势偏离百分比、0%中心线、水平±1σ/±2σ。
3. Recent 10Y Quarterly：截至最新可信共同季度，取最近40个连续季度，展示BI及同一长期趋势和σ线。

短期图是长期模型的近10年季度视图，不是另建短期滚动模型。本规范不包含20个月均线、20季度均线、月度数据补齐或5年图。三张图不能互相替代或只输出其中一张。

每次新生成应保存三张PNG、三张矢量PDF、一份合并三页PDF、逐期计算值、模型参数、来源/版本、质量校验结果和运行状态；可复现包包含代码与固定输入。缓存复用时直接读取现有输出，不需重复生成。

## 2. 云盘发现与固定数据

项目文件夹：Buffett_Indicator，ID `1TIHcsBqDkVMLjXQiwnLk42LDI3tpw_w5`。
URL：https://drive.google.com/drive/folders/1TIHcsBqDkVMLjXQiwnLk42LDI3tpw_w5

先读取本指示书及Buffett_Project_State_v2.json，不能沿用旧的Project_Scope_20261007.json或Recent_Chart_State_v1.json。v2状态指向当前三图及其数据版本。若有后续明确的新规范，按新规范执行并保留旧版本。

固定数据：Buffett_Quarterly_Frozen_v1.json，Drive ID `1178kx3g3TQ7UpBzlcFL1C8jK8IOF8REJ`。
初始状态：Buffett_Cache_State_v1.json，ID `1ObkAgef62_Leo5FwucIzHDcm79ZpYgXV`。
基线归档：Buffett_Frozen_Baseline_20261007.zip，ID `1lDWFz9wLspng8DsgaGW-wmo-gEfhSgAL`。

下载前读取Drive metadata确认非原生JSON类型，再以raw fetch取得完整文件引用，下载文件，校验SHA-256：
`811a45df3978d0e4e41d85012a737683014f5eba579ba5584a92536e2af68b1a`。

校验失败立即停止正式绘图，不用损坏文件、不自动重建旧历史。原始基线覆盖1952Q1—2026Q2，共298期。

## 3. 数据定义与不可修改规则

市场单位：百万美元；GDP：十亿美元，名义GDP，季调年率。
`BI_pct = market_cap_usd_million / 1000 / gdp_usd_billion_saar * 100`。

1996Q4起：`market_cap = public − ETF − closed_end`。
对应FRED系列：BOGZ1LM883164115Q、BOGZ1FL564090005Q、BOGZ1FL554090005Q。
GDP系列为BEA通过FRED发布的GDP。

1952Q1—1996Q3共179期：`market_cap = (total − ETF − closed_end) * fixed_public_share`。
total为BOGZ1LM883164105Q。固定公开股权占比为
`0.8877238600607575316245036745057902296845`，由1996Q4—2001Q3共20期公开/总股权扣基金后比例的中位数取得。
这些是历史估计，quality=HISTORICAL_ESTIMATE_FROZEN、is_fitted=true。1996Q4以后quality=FED_OFFICIAL_DERIVED、is_fitted=false。每行source_values保留发布原值。

**历史整理段永久冻结，不更新、不重新拟合、不重新抓取后覆盖，不按参考图反向校准。** 最早起点为1952Q1，不恢复已排除的1947起点。2016以来基础观测不可任意修改、拟合、插值或缩放。

近期使用对应内容最新可信官方发布值，优先实际发布值于预测。数值必须匹配同一季度；记录观测期与发布日期，不能把不同日期混成伪同日指标。官方数据仍可能后续修订，“最终可信值”表示当时最新发布版本，并非永不修订。

当前v1全部已保存行保留原样。新季度只能追加到新版本；官方修订仅能在独立新版本与差异记录中显式保存，绝不静默覆盖原基线。新版本若改变近期历史观测，不能继续声称原基线未修改；需要明确披露并取得用户对采纳修订的决定。用户未要求采纳时继续复用基线。老历史估计在所有版本中保持原值和原系数。

这是用户已接受的Fed统计口径，不保证与NYSE/Nasdaq逐家公司汇总或Wilshire市值完全一致。不得混入稀疏Siblis年度值再声称同口径连续。

## 4. 唯一长期模型

设t为距1952Q1的年数，季度间隔0.25年。对当前全部可用季度执行普通最小二乘：
`ln(BI_pct) = a + b*t + residual`。
`trend_pct = exp(a+b*t)`。
` sigma_log = sqrt(sum(residual**2)/(n-2)) `，自由度n−2。

expanding表示后续新增季度可扩展全历史拟合样本；本图为当前全样本回归，不是每个历史时点仅用当时数据的实时回测。趋势回归更新不等于基础历史值重建，二者必须分开。

Historical及Recent 10Y的带：
`band_k = trend_pct * exp(k*sigma_log)`，k=−2、−1、+1、+2。

Detrended：
`deviation_pct = (BI_pct/trend_pct−1)*100 = expm1(residual)*100`。
中心线为0%；水平带为`expm1(k*sigma_log)*100`。
Z-score=`residual/sigma_log`；不可用deviation_pct直接除以sigma_log。sigma接近0时Z显示不可用。

正负σ线转换成百分比后不对称，这属于当前对数残差定义。此前提出的相对偏离标准差口径仅是建议，未获确认，**本次“其他保持不变”不得触发σ算法切换**。不宣称复刻CMV算法，亦不使用其2.6σ强行校准。本模型的带是残差离散程度，不是统计置信区间或预测区间。

## 5. 三图窗口与视觉

Historical和Detrended都使用全部季度，不抽样，不按年度聚合。Recent 10Y取最新共同季度往前40期，必须连续，无缺口。当前窗口2016Q3—2026Q2。短期窗口不重估a、b、sigma，直接截取上述长期模型；标题和图例注明long-term。若以后用户改为独立短期模型，需新规范说明窗口和自由度。

沿用现有白底宽幅样式，15×7.6英寸，PNG 180dpi，PDF矢量。蓝线BI/偏离；灰色虚线趋势/0%；+1σ橙色虚线；+2σ红色虚线；−1σ浅绿虚线；−2σ深绿虚线。
颜色：蓝#2b6fc1、灰#818b95、橙#df8b25、红#c64b4b、浅绿#8abb77、深绿#2e7951。

Historical与短期纵轴为Market Value/GDP (%)，不归一化、不改为Z轴。Detrended纵轴为Deviation from exponential trend (%)。日期清晰标明到季度。Historical/Detrended以浅灰阴影标出1996Q4之前的估计段，1996Q4用竖向分界线；Recent 10Y不包含估计点。

上方显示最后一期BI、趋势及Z；Detrended显示偏离及Z。下方放来源、市场定义、历史估计说明及σ口径。图例不挡数据，最新标签不裁切，年/季度标签不挤在一起，轴范围覆盖全部数据与σ线。显示英文沿用现有图表，说明可中文。

## 6. 查看、缓存与刷新

1. 用户请求查看时，先读当前Drive状态和本规范。
2. 若距上次三图生成不超过1个日历月，且没有强制更新/改版指令，直接返回缓存三图。按日历月比较，不固定为30天。
3. 超过1个月，轻量检查官方源最新观测季度及发布版本。版本没有变化则继续返回缓存，记录检查日期。
4. 新季度发布或用户强制更新时，取得同季度全部官方输入，保存独立新快照和出处，逐行确认老估计段、基线未被覆盖，再重算趋势派生值和三图。强制更新也不能解冻老历史。
5. 官方修订与基线不同时，按第3节独立记录，不自动覆盖。不能只比较最新日期而忽略同日期版本修订。
6. 若当前只取得部分输入，不制造最后一期；使用最近共同完整季度并解释落后原因。
7. 生成成功并完成校验后才更新状态中的generated_at、data_through、snapshot及输出ID/hash。失败不把旧图标成新图、不把不完整执行标成成功。

本规范未部署后台自动任务、网站、MCP服务或邮件发送。它指导以后AI按需执行，不声称已建立自动化。

## 7. 必做校验

- 数据hash匹配登记版本；period唯一且逐季连续；GDP和市值为正、无缺值。
- 原值不被派生计算改写；历史估计标记与1996Q4分界一致；近期无拟合或插值。
- 单位换算及同季度匹配正确；三图共享同一a、b、sigma和输入版本。
- OLS残差均值约0且与t正交；偏离反算BI与原值一致。
- 短期恰好40期、最新点与Historical一致；短期σ不得重新计算。
- 同一基线重画时两张长期图参数不变。
- PNG完整可解码；PDF共三页；人工/视觉查看三图布局，修复标签重叠后再发布。
- Drive上传后读metadata；对关键指示书/归档下载读回并比对SHA-256。保存成功才给用户链接。

当前参考参数：n=298，a=3.7517877600036833，b=0.016375401068659763/年，sigma_log=0.3385719898464284；2026Q2 BI=238.42581602510577%，trend=143.6904437312909%，deviation=65.9301828526435%，Z=1.4956846515931057。仅此版本用于回归校验，新季度扩展后参数可变但基础冻结数据不能变。

## 8. 离线生成入口

复现包已包含固定输入和程序。执行：`python3 generate_all.py`。
依赖：Python3、numpy、matplotlib、pypdf、Pillow。程序无联网与历史刷新逻辑。
其输出为Historical、Detrended、Recent_10Y_Quarterly的PNG/PDF，以及Buffett_Three_Charts.pdf和计算参数。在线AI应先按第2及第6节读取Drive/cache，再决定是否运行，不能每次查看都重建数据。

## 9. 可直接交给AI的执行提示

“读取Buffett_Indicator项目最新v2或后续指示书及状态。按缓存规则返回或生成Historical、Detrended、Recent 10Y Quarterly三图。数据只从登记的Drive版本读取，校验hash，冻结历史不得刷新。三图共享全历史指数回归与对数残差σ，短期40季度只截取长期模型。取消20M、月频、5年图。使用当前可得可信且季度匹配的官方输入，保留原基线及出处。完成数学、数据、图像和云盘读回校验后保存输出与状态，并同时展示三图；如失败明确指出缺口，不修改数据伪造成功。”
