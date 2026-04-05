# Phase P05 日志

## 概要

在 `ImageSourcePath.arrivalPressure()` 中并入声源指向性修正，并完成 Omni/CLF 路径回归测试。

## 本次目标

- 将方向性压力缩放并入路径声压起点
- 保证 Omni 模式与现有行为兼容
- 使 CLF 模式能反映出方向差异

## 变更范围

- `src/compute/raytracer/image-source/index.ts`
- `src/compute/raytracer/image-source/directivity.ts`
- `src/__tests__/image-source-directivity/image-source-arrival.spec.ts`

## 实施步骤

1. 在 `arrivalPressure()` 开头将 SPL 转成压力
2. 按路径首段方向施加 source directivity 压力缩放
3. 再沿用现有反射损耗和空气衰减逻辑
4. 补充 Omni/CLF 路径测试

## 发现的问题

- 需要在压力域施加方向性缩放，避免与后续强度域衰减顺序混乱

## 决策记录

- 指向性修正只在真实声源的出射点施加一次
- 使用相对压力比而不是修改镜像源几何逻辑

## 测试执行记录

- 命令：`node node_modules\\jest\\bin\\jest.js --runInBand --watchAll=false src/__tests__/image-source-directivity/image-source-arrival.spec.ts`
- 结果：PASS

## 结果

- Omni 路径结果保持一致
- CLF 模式下 off-axis 路径声压降低

## 下一步

- 进入 P06，增强导出字段和前端入口
