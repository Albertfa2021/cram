# Phase P06 日志

## 概要

增强路径导出字段，并在 `Image Source` 前端面板增加手动 CLF 输入窗口。

## 本次目标

- 为路径导出补充方向方向量、角度和逐频带方向性信息
- 在 Image Source 前端中增加手动 CLF 输入窗口
- 提供将手动输入 CLF 应用到所选 source 的可测试逻辑

## 变更范围

- `src/compute/raytracer/image-source/index.ts`
- `src/components/parameter-config/image-source-tab/ImageSourceTab.tsx`
- `src/components/parameter-config/image-source-tab/ImageSourceTab.css`
- `src/components/parameter-config/image-source-tab/clf-import.ts`
- `src/__tests__/image-source-directivity/clf-import.spec.ts`

## 实施步骤

1. 在 `extractPathData()` 中追加方向性导出字段
2. 在 Image Source 面板中新增 `Source Directivity` 区域
3. 增加可弹出的手动 CLF 输入窗口
4. 支持文件选择和手动粘贴 CLF 文本
5. 支持对目标 source 应用 CLF 和重置为 Omni
6. 将 CLF 应用逻辑抽成可测试 helper

## 发现的问题

- 当前主参数面板缺少稳定的 CLF 导入入口，旧入口只在旧对象属性视图中存在

## 决策记录

- 将手动 CLF 输入窗口直接集成到 Image Source 面板
- 不依赖外部下载样例，前端支持本地 `.tab` 文件和手动粘贴文本

## 测试执行记录

- 命令：`node node_modules\\jest\\bin\\jest.js --runInBand --watchAll=false src/__tests__/image-source-directivity/clf-import.spec.ts`
- 结果：PASS

## 结果

- 路径导出已包含方向性字段
- Image Source 面板已支持手动导入 CLF 并应用到选定 source
- 修复了 `Target Source` 只能读取 solver 已绑定 source 的交互缺陷，现在会直接列出场景里的全部 source，并在选择时自动绑定到当前 solver
- 手动 CLF 输入窗口现在内置默认示例 CLF，打开后可直接应用进行验证

## 下一步

- 进入 P07，做总回归并等待手动验证
