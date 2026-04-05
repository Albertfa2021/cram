# Phase P03 日志

## 概要

建立世界方向到 source-local `phi/theta` 的统一换算工具，并完成版本兼容适配。

## 本次目标

- 建立统一的方向换算入口
- 保证与现有 CRAM 角度约定一致
- 兼容仓库当前 `three@0.111` 版本

## 变更范围

- `src/compute/raytracer/image-source/directivity.ts`
- `src/__tests__/image-source-directivity/directivity-helpers.spec.ts`

## 实施步骤

1. 实现世界方向到 source-local 方向向量变换
2. 实现 local direction 到 CRAM `phi/theta` 反算
3. 实现方向性压力缩放和诊断信息输出
4. 修复 `three@0.111` 中缺少 `MathUtils` 和 `Quaternion.invert()` 的兼容问题

## 发现的问题

- 当前项目的 Three.js 版本较老，部分新 API 不可用

## 决策记录

- 使用 `THREE.Math` 和 `Quaternion.inverse()` 适配旧版 Three.js
- 将方向诊断数据做成导出友好的纯数值结构

## 测试执行记录

- 命令：`node node_modules\\jest\\bin\\jest.js --runInBand --watchAll=false src/__tests__/image-source-directivity/directivity-helpers.spec.ts`
- 结果：PASS

## 结果

- 角度换算入口已稳定
- 后续 ISM 与导出链路都可复用同一组工具

## 下一步

- 进入 P04，补 ISM 路径首段方向提取
