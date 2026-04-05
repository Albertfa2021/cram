# Phase P04 日志

## 概要

在 `ImageSourcePath` 中补入首段出射方向提取与路径级方向诊断。

## 本次目标

- 为每条 ISM 路径提取真实声源的首段出射方向
- 为后续声压结算和导出提供统一入口

## 变更范围

- `src/compute/raytracer/image-source/index.ts`
- `src/compute/raytracer/image-source/directivity.ts`
- `src/__tests__/image-source-directivity/image-source-arrival.spec.ts`

## 实施步骤

1. 为 `ImageSourcePath` 增加 `baseSource`
2. 增加 `getEmissionDirectionWorld()`
3. 增加 `getSourceDirectionDiagnostics()`
4. 为路径级行为增加单测

## 发现的问题

- `ImageSourcePath` 所在模块依赖较重，测试时需要最小 mock 渲染与音频层

## 决策记录

- 保留现有 ISM 几何链路不动，仅在路径层补方向信息
- 测试中对渲染器与音频引擎做最小 mock

## 测试执行记录

- 命令：`node node_modules\\jest\\bin\\jest.js --runInBand --watchAll=false src/__tests__/image-source-directivity/image-source-arrival.spec.ts`
- 结果：PASS

## 结果

- 路径首段方向提取已可用于声压与导出链路

## 下一步

- 进入 P05，将源指向性接入路径声压结算
