# Phase P01 日志

## 概要

建立本轮改造的集中测试目录与稳定的 Jest 执行入口。

## 本次目标

- 建立统一测试目录与命名约定
- 修复当前仓库 Jest 解析器缺失导致的测试不可运行问题
- 固定首批测试范围与 fixture 组织方式

## 变更范围

- `src/__tests__/image-source-directivity/`
- `src/test-fixtures/image-source-directivity/`
- `config/jest/resolver.js`
- `package.json`

## 实施步骤

1. 建立 `image-source-directivity` 集中测试目录
2. 新建轻量 fixture 目录，避免 CLF 大样例拖慢单测
3. 为 Jest 增加本地 resolver shim，替代缺失的 `jest-pnp-resolver`
4. 改为使用直接 Jest 入口执行本轮测试

## 发现的问题

- 原仓库的 Jest 配置依赖 `jest-pnp-resolver`，但当前环境未安装该包
- CRA `scripts/test.js` 入口在当前环境中不稳定，直接 Jest 入口更可靠

## 决策记录

- 本轮测试统一通过 `node node_modules\\jest\\bin\\jest.js` 执行
- 本轮测试 fixture 不使用仓库内大 CLF 文件，改用程序生成的小型 CLF

## 测试执行记录

- 命令：`node node_modules\\jest\\bin\\jest.js --runInBand --watchAll=false src/__tests__/image-source-directivity`
- 结果：PASS

## 结果

- 测试入口稳定可用
- 后续 phase 可按“先测后做”推进

## 下一步

- 进入 P02，建立 CLF 解析和 DirectivityHandler 基线测试
