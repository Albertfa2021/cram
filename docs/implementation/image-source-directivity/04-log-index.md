# 实施日志索引

## 索引表

| 日期 | Phase | 模块 | 摘要 | 测试结果 | 详细日志 |
|---|---|---|---|---|---|
| 2026-04-05 | P00 | M01 文档与追溯基础设施 | 建立 Image Source 指向性开发文档树，固定概念方案与实施骨架 | PASS | `logs/phase-p00.md` |
| 2026-04-05 | P01 | M02 测试基础设施与统一管理 | 建立集中测试目录、Jest 解析兼容层与测试 fixture 组织方式 | PASS | `logs/phase-p01.md` |
| 2026-04-05 | P02 | M03 CLF 解析与指向性数据校验 | 修复 CLF 最后一个频带解析缺陷，补齐 CLF Parser 与 DirectivityHandler 单测 | PASS | `logs/phase-p02.md` |
| 2026-04-05 | P03 | M04 方向坐标与角度换算 | 建立世界方向到 source-local phi/theta 的统一换算工具并通过单测 | PASS | `logs/phase-p03.md` |
| 2026-04-05 | P04 | M05 ISM 路径首段出射方向提取 | 在 ImageSourcePath 中补入首段出射方向提取与方向诊断接口 | PASS | `logs/phase-p04.md` |
| 2026-04-05 | P05 | M06 ISM 声压链路并入源指向性 | 在 arrivalPressure 中接入源指向性修正并通过 Omni/CLF 回归测试 | PASS | `logs/phase-p05.md` |
| 2026-04-05 | P06 | M07 导出与观测字段增强 | 为路径导出增加发射方向、phi/theta 和逐频带方向性字段 | PASS | `logs/phase-p06.md` |
| 2026-04-05 | P07 | M08 回归测试与验收收口 | 全部新增自动化测试通过，等待手动前端验证 | PASS | `logs/phase-p07.md` |

## 记录规则

- 每次 phase 活动至少追加一条索引
- 测试结果统一写为 `PASS`、`FAIL`、`NOT RUN`
- 详细日志文件命名统一为 `phase-pxx.md`

## 2026-04-05 Supplement

| 日期 | Phase | 模块 | 摘要 | 测试结果 | 详细日志 |
|---|---|---|---|---|---|
| 2026-04-05 | P02 / P07 | M03 CLF 解析与数据校验 / M08 回归测试与验收收口 | 下载并验证 clfgroup 官网二进制样例 `Coax8.CF2` 与 `cal-3150.CF1`，补齐 `.CF1/.CF2` 导入链路、官方样例 fixture 与回归测试 | PASS | `logs/phase-p02.md`, `logs/phase-p07.md` |
| 2026-04-05 | P07 | M08 回归测试与验收收口 | 用户手动验证 `Coax8.CF2` 导入与导出结果差异，确认真实 CLF 已参与 Image Source 计算 | PASS | `logs/phase-p07.md` |
