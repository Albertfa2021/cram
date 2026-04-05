# 实施 Phase 索引

## Phase 总表

| Phase ID | 名称 | 目标 | 前置条件 | 进入条件 | 完成条件 | 关联日志 | 关联测试 | 当前状态 |
|---|---|---|---|---|---|---|---|---|
| P00 | 文档骨架建立 | 建立文档体系与规则 | 无 | 方案已确认 | 核心文档骨架完成 | `logs/phase-p00.md` | 文档结构校验 | Completed |
| P01 | 测试基线建立 | 统一测试目录与测试入口 | P00 | 文档已固定 | 测试组织方式明确 | `logs/phase-p01.md` | Jest 测试基线 | Completed |
| P02 | CLF 数据校验 | 建立 CLF 解析与 handler 基础可信度 | P01 | 测试目录可用 | CLF 解析测试通过 | `logs/phase-p02.md` | CLF Parser / DirectivityHandler | Completed |
| P03 | 角度换算 | 建立统一方向换算入口 | P02 | CLF 数据可信 | 角度换算测试通过 | `logs/phase-p03.md` | direction-to-angle | Completed |
| P04 | 路径首段方向提取 | 为 ISM 路径提取出射方向 | P03 | 角度换算可用 | 路径方向测试通过 | `logs/phase-p04.md` | image-source path direction | Completed |
| P05 | 指向性并入声压链路 | 在 arrivalPressure 中接入 source directivity | P04 | 路径方向已可用 | Omni/CLF 路径声压测试通过 | `logs/phase-p05.md` | arrivalPressure directivity | Completed |
| P06 | 导出增强 | 导出方向性观测字段 | P05 | 声压链路完成 | 导出字段测试通过 | `logs/phase-p06.md` | export data | Completed |
| P07 | 回归与验收 | 汇总测试、日志和状态 | P06 | 所有功能完成 | 全部测试通过并收口 | `logs/phase-p07.md` | full regression | In Progress |

## Phase 依赖说明

- `P00` 是所有后续工作的基础
- `P01` 到 `P06` 严格顺序执行
- `P07` 只能在所有功能测试通过后启动

## Phase 状态枚举

- `Planned`
- `In Progress`
- `Blocked`
- `Completed`

## Phase 关闭规则

一个 phase 关闭前必须满足：

- 对应功能实现完成
- 对应测试全部通过
- 对应详细日志已记录
- 状态记录已同步更新

## 2026-04-05 Note

- `P02` 已扩展为同时覆盖官网二进制 `CF1/CF2` 导入校验
- `P07` 当前自动化回归已包含：
  - 文本 `.tab`
  - 官网 `Coax8.CF2`
  - 官网 `cal-3150.CF1`
