# Image Source 指向性开发文档总览

## 文档目的

本目录用于统一管理 `Image Source Method` 并入声源指向性的开发文档、实施计划、阶段记录、日志索引与状态跟踪。

本文档体系服务于以下目标：

- 固定概念方案，避免实施过程中目标漂移
- 将实施任务拆分为可测试、可追溯的阶段
- 明确每个模块的权力范围与安全约束
- 保证每个功能点开发后先测试通过，再进入下一步
- 统一日志、状态、测试记录入口

## 文档结构

- `00-overview.md`
  - 文档总览与使用说明
- `01-concept-plan.md`
  - 已确认的概念方案
- `02-implementation-plan.md`
  - 详细实施方案
- `03-phase-index.md`
  - 实施阶段索引
- `04-log-index.md`
  - 实施日志索引
- `05-status-tracker.md`
  - 实施状态记录
- `logs/`
  - 分 phase 详细日志
- `artifacts/test-records/`
  - 测试执行记录与归档占位

## 使用规则

1. 任何实现前，先阅读 [01-concept-plan.md](/D:/Harmman--VirtualListenning/cram/docs/implementation/image-source-directivity/01-concept-plan.md) 和 [02-implementation-plan.md](/D:/Harmman--VirtualListenning/cram/docs/implementation/image-source-directivity/02-implementation-plan.md)。
2. 每进入一个 phase，先在 [03-phase-index.md](/D:/Harmman--VirtualListenning/cram/docs/implementation/image-source-directivity/03-phase-index.md) 和 [05-status-tracker.md](/D:/Harmman--VirtualListenning/cram/docs/implementation/image-source-directivity/05-status-tracker.md) 更新状态。
3. 每次实施后，必须记录日志并更新 [04-log-index.md](/D:/Harmman--VirtualListenning/cram/docs/implementation/image-source-directivity/04-log-index.md)。
4. 每个功能点必须先通过对应测试，再允许进入下一任务。
5. 所有新增文档、日志、测试记录统一使用 UTF-8 编码，文件名使用 ASCII。

## 当前边界

- 首版目标仅为“声源指向性进入 Image Source Method”
- 接收器指向性不纳入本轮主计算链
- 反射面仍按现有镜面反射与吸收模型处理
- 文档、日志、测试与代码实施同步推进
