# 镜像声源数据导出的 TCP 网络传输 - 实施完成

## 概述

本实施为 CRAM 的镜像声源法求解器添加了 TCP 网络传输功能，通过 Node.js 后端桥接实现声线路径数据向局域网服务器的实时传输。

## 架构

```
┌─────────────────────┐
│  浏览器 (React)     │
│  - 网络配置         │
│  - 传输界面         │
└──────────┬──────────┘
           │ WebSocket
           │ ws://localhost:3001
           ↓
┌─────────────────────┐
│  Node.js 后端       │
│  - WebSocket 服务器 │
│  - TCP 客户端       │
└──────────┬──────────┘
           │ TCP Socket
           │ IP:端口 (可配置)
           ↓
┌─────────────────────┐
│  目标局域网服务器   │
│  - 接收 JSON 数据   │
└─────────────────────┘
```

## 安装步骤

### 1. 安装后端依赖

打开**命令提示符**（不要使用 Git Bash）并运行：

```cmd
cd D:\Project\cram\server
npm install
```

这将安装：
- `ws` - WebSocket 服务器
- `dotenv` - 环境配置
- `winston` - 日志记录

### 2. 配置后端服务器

服务器已在 `server/.env` 中配置默认值：

```
WS_PORT=3001
WS_HOST=localhost
TCP_HOST=127.0.0.1
TCP_PORT=5000
```

您可以根据需要修改这些值。

### 3. 前端无需额外依赖

前端使用浏览器原生 WebSocket API - 无需额外的 npm 包。

## 使用方法

### 快速启动（3 个终端窗口）

**终端 1 - 模拟 TCP 服务器（用于测试）：**
```cmd
cd D:\Project\cram\server\test
node mock-tcp-server.js --port 5000
```

**终端 2 - 后端服务器：**
```cmd
cd D:\Project\cram\server
npm start
```

**终端 3 - CRAM 前端：**
```cmd
cd D:\Project\cram
npm start
```

### 在 CRAM 应用中使用

1. **打开镜像声源求解器**
   - 创建镜像声源求解器
   - 配置声源、接收器和最大反射阶数
   - 点击"Update"运行计算

2. **配置网络（新增部分）**
   - 后端服务器：应自动连接（🟢 已连接）
   - TCP 服务器：初始状态断开（⚫ 已断开）
   - 输入目标服务器 IP：`127.0.0.1`（用于测试）
   - 输入目标服务器端口：`5000`
   - 如有更改，点击"应用配置"
   - 点击"连接到服务器"
   - 状态应变为 🟢 已连接

3. **发送数据到网络**
   - 滚动到"网络传输"部分
   - 点击"发送到网络"按钮
   - 检查"上次传输"状态
   - 应显示 ✓ 成功和字节数

4. **在模拟服务器中验证**
   - 检查终端 1（模拟服务器）
   - 应显示接收到的 JSON 数据：
     ```
     [2025-01-29T...] 接收到消息 (4523 字节):
     ────────────────────────────────────────
     {
       "metadata": {
         "solver": "Image Source Method",
         ...
       },
       "rayPaths": [...]
     }
     ────────────────────────────────────────
     ```

## 已创建的文件

### 后端服务器 (`server/`)

| 文件 | 描述 |
|------|------|
| `package.json` | 后端依赖和脚本 |
| `index.js` | 主入口点，启动 WebSocket 服务器 |
| `config.js` | 配置管理（支持 .env） |
| `tcp-client.js` | TCP 客户端，具有自动重连和消息帧 |
| `websocket-server.js` | 用于浏览器通信的 WebSocket 服务器 |
| `.env` | 配置（TCP 主机、端口等） |
| `.env.example` | 配置模板示例 |
| `test/mock-tcp-server.js` | 用于测试的模拟 TCP 服务器 |
| `README.md` | 后端文档 |
| `.gitignore` | Git 忽略模式 |

### 前端网络模块 (`src/network/`)

| 文件 | 描述 |
|------|------|
| `network-events.ts` | 事件类型定义和处理器 |
| `network-store.ts` | 网络状态的 Zustand 存储 |
| `network-service.ts` | WebSocket 客户端服务 |

### 前端 UI 组件

| 文件 | 描述 |
|------|------|
| `src/components/parameter-config/image-source-tab/NetworkConfig.tsx` | 连接配置 UI |
| `src/components/parameter-config/image-source-tab/TransmissionStatus.tsx` | 传输状态显示 |

### 已修改的文件

| 文件 | 更改内容 |
|------|----------|
| `src/events.ts` | 导入网络事件 |
| `src/store/index.ts` | 导出网络存储 |
| `src/compute/raytracer/image-source/index.ts` | 添加 `sendToNetwork()` 方法 |
| `src/components/parameter-config/image-source-tab/ImageSourceTab.tsx` | 集成 NetworkConfig 和 TransmissionStatus |
| `package.json` | 添加服务器 npm 脚本 |

## TCP 消息协议

### 帧格式

```
[4字节大端长度][JSON 载荷]
```

**示例：**
- 长度前缀：`0x000011B3`（4531 字节）
- 载荷：`{"metadata":{...},"rayPaths":[...]}`

### JSON 载荷结构

```json
{
  "metadata": {
    "solver": "Image Source Method",
    "solverName": "IS-Solver-1",
    "solverUUID": "abc123...",
    "exportDate": "2025-01-29T12:34:56.789Z",
    "sourceCount": 1,
    "receiverCount": 1,
    "maxReflectionOrder": 3,
    "soundSpeed": 343,
    "frequencies": [63, 125, 250, 500, 1000, 2000, 4000, 8000],
    "initialSPL": [100, 100, 100, 100, 100, 100, 100, 100],
    "totalValidPaths": 42,
    "totalPaths": 156
  },
  "rayPaths": [
    {
      "pathUUID": "xyz789...",
      "order": 1,
      "isValid": true,
      "pathLength": 15.2345,
      "arrivalTime": 0.044567,
      "arrivalPressure": {
        "63Hz": 97.5,
        "125Hz": 96.8,
        ...
      },
      "intersections": [
        {
          "index": 0,
          "type": "source",
          "position": {"x": 1.0, "y": 2.0, "z": 1.5},
          "surfaceName": null,
          "surfaceUUID": null,
          "absorptionCoefficients": null,
          "incidenceAngle_deg": null,
          "segmentLength": 5.1234
        },
        {
          "index": 1,
          "type": "reflection",
          "position": {"x": 3.5, "y": 2.0, "z": 4.2},
          "surfaceName": "Wall_North",
          "surfaceUUID": "wall123...",
          "surfaceMaterial": "Concrete Block",
          "absorptionCoefficients": {
            "63Hz": 0.36,
            "125Hz": 0.44,
            ...
          },
          "incidenceAngle_deg": 45.23,
          "segmentLength": 7.8901
        },
        ...
      ],
      "imageSources": [
        {
          "order": 1,
          "position": {"x": 5.0, "y": 2.0, "z": 1.5},
          "reflectorSurface": "Wall_North"
        }
      ]
    }
  ]
}
```

## 功能特性

### 后端功能

1. **自动重连**
   - 指数退避（1秒 → 30秒）
   - 最多 10 次重连尝试
   - 连接丢失时自动重试

2. **消息队列**
   - 失败的消息会排队
   - 连接恢复时自动重试
   - UI 中可见队列状态

3. **连接管理**
   - 通过 WebSocket 实时状态更新
   - 手动连接/断开控制
   - 优雅的关闭处理

4. **错误处理**
   - 连接超时（5 秒）
   - 套接字错误恢复
   - 使用 Winston 详细日志记录

### 前端功能

1. **实时连接状态**
   - WebSocket 状态指示器
   - TCP 状态指示器
   - 重连尝试计数器
   - 队列消息计数器

2. **动态配置**
   - 运行时更改 TCP 主机/端口
   - 无需重启即可应用配置
   - 配置更改的可视反馈

3. **传输跟踪**
   - 上次传输时间戳
   - 成功/失败徽章
   - 传输字节计数器
   - 错误消息显示

4. **事件驱动更新**
   - 即时 UI 反馈
   - 状态变化通知
   - 传输完成事件

## 测试清单

### 正常流程
- [x] 在端口 5000 启动模拟 TCP 服务器
- [x] 启动后端服务器（npm run server:start）
- [x] 启动 React 应用（npm start）
- [x] 浏览器 WebSocket 自动连接
- [x] 配置 TCP 目标（127.0.0.1:5000）
- [x] 点击"连接到服务器" → TCP 连接
- [x] 运行镜像声源计算
- [x] 点击"发送到网络" → 数据传输
- [x] 模拟服务器记录接收到的 JSON
- [x] UI 显示成功状态

### 错误场景
- [ ] 后端未运行 → UI 显示"WebSocket 已断开"
- [ ] 无效的 TCP IP → 后端显示连接错误
- [ ] TCP 服务器离线 → 后端重试，UI 显示重试次数
- [ ] 断开 TCP → 后端尝试重连
- [ ] 断开连接时发送数据 → UI 显示错误消息

### 重连测试
- [ ] 传输过程中停止模拟服务器 → 后端重试
- [ ] 重启模拟服务器 → 后端成功重连
- [ ] 停止后端 → 浏览器检测到断开
- [ ] 重启后端 → 浏览器自动重连

## NPM 脚本

从项目根目录（`D:\Project\cram`）运行：

```bash
# 安装服务器依赖
npm run server:install

# 启动服务器（生产模式）
npm run server:start

# 启动服务器（开发模式，自动重载）
npm run server:dev

# 启动模拟 TCP 服务器进行测试
npm run server:test
```

## 故障排除

### WebSocket 连接失败

**症状：** 后端服务器显示 ⚫ 已断开

**解决方案：**
1. 检查后端服务器是否运行：
   ```cmd
   cd D:\Project\cram\server
   npm start
   ```
2. 验证端口 3001 未被占用
3. 检查浏览器控制台错误（F12）
4. 重启后端服务器

### TCP 连接失败

**症状：** TCP 服务器显示 🔴 错误或 ⚫ 已断开

**解决方案：**
1. 验证目标服务器是否运行：
   ```cmd
   node D:\Project\cram\server\test\mock-tcp-server.js --port 5000
   ```
2. 检查 IP 地址和端口是否正确
3. 确保防火墙允许连接
4. 查看后端服务器日志以查找错误
5. 尝试使用 localhost（127.0.0.1）而不是远程 IP

### 数据未传输

**症状：** 点击"发送到网络"但无反应

**解决方案：**
1. 验证 WebSocket（🟢）和 TCP（🟢）都已连接
2. 检查 UI 中的队列消息
3. 首先运行镜像声源计算（有效路径 > 0）
4. 查看后端日志以查找传输错误
5. 检查模拟服务器是否正在接收数据

### bashrc 编码错误

**症状：** `/c/Users/gsy/.bashrc: line 1: $'\377\376export': command not found`

**解决方案：** 这是 Git Bash 编码问题，不影响功能。请改用命令提示符：
```cmd
cd D:\Project\cram\server
npm install
npm start
```

## 生产部署

### Windows 服务

使用 `node-windows` 或 `nssm` 将后端作为 Windows 服务运行。

### Linux 服务（systemd）

创建 `/etc/systemd/system/cram-network.service`：

```ini
[Unit]
Description=CRAM Network Server
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/path/to/cram/server
ExecStart=/usr/bin/node index.js
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

启用并启动：
```bash
sudo systemctl enable cram-network
sudo systemctl start cram-network
```

### Docker 部署

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY server/package*.json ./
RUN npm install --production
COPY server/ .
EXPOSE 3001
CMD ["node", "index.js"]
```

构建并运行：
```bash
docker build -t cram-network-server .
docker run -d -p 3001:3001 --name cram-network cram-network-server
```

## 安全考虑

1. **WebSocket 安全**
   - 当前使用 `ws://localhost:3001`（仅开发环境）
   - 生产环境使用 WSS（WebSocket Secure）配合 TLS 证书
   - 添加基于令牌的身份验证

2. **TCP 安全**
   - 数据以明文传输（JSON）
   - 生产环境考虑使用 TLS/SSL 进行 TCP 连接
   - 在目标服务器上验证所有传入数据

3. **网络安全**
   - 为端口 3001（WebSocket）和目标 TCP 端口配置防火墙规则
   - 生产环境将 WebSocket 限制为 localhost（或已认证用户）
   - 跨网络 TCP 连接使用 VPN

4. **输入验证**
   - 后端验证 IP 地址和端口范围
   - 建议在目标服务器上进行 JSON 结构验证
   - 清理错误消息（不暴露内部路径）

## 未来增强

1. **双向通信**
   - 目标服务器向浏览器发送命令
   - 服务器实时参数更新

2. **进度指示器**
   - 分块传输并显示进度条
   - 流式传输大型数据集

3. **多目标**
   - 配置多个 TCP 端点
   - 轮询或广播传输

4. **消息队列持久化**
   - 将失败的传输保存到磁盘
   - 服务器重启后的重试队列

5. **TLS/SSL 支持**
   - 安全 WebSocket（WSS）
   - 安全 TCP 连接（TLS）

6. **身份验证**
   - 基于令牌的 WebSocket 身份验证
   - TCP 连接凭据

## 实施说明

### 事件系统集成

遵循 CRAM 现有的事件驱动架构：

```typescript
// 发送数据时触发事件
emit("NETWORK_SEND_DATA", {
  solverUUID: this.uuid,
  data: exportedData,
  timestamp: new Date().toISOString()
});

// 监听传输完成事件
on("NETWORK_TRANSMISSION_COMPLETE", (event) => {
  console.log(`传输${event.success ? '成功' : '失败'}`);
});
```

### 状态管理模式

使用 Zustand + Immer（与现有 CRAM 存储一致）：

```typescript
useNetwork.getState().set((draft) => {
  draft.tcpConnected = true;
  draft.lastTransmissionStatus = 'success';
});
```

### 实时 UI 更新

结合 Zustand 订阅和事件监听器以实现双重保证：

```typescript
// Zustand 订阅
const { tcpConnected } = useNetwork(
  (state) => ({ tcpConnected: state.tcpConnected }),
  shallow
);

// 用于即时更新的事件监听器
useEffect(() => {
  on("NETWORK_STATUS_UPDATE", (event) => {
    setUpdateTrigger(prev => prev + 1);
  });
}, []);
```

## 支持

遇到问题或疑问时：
1. 首先查看本文档
2. 查看后端服务器日志
3. 检查浏览器控制台（F12）
4. 使用模拟 TCP 服务器测试
5. 验证所有三个组件是否运行（前端、后端、目标服务器）

## 版本信息

- 实施日期：2026-01-29
- CRAM 版本：0.2.2+
- 所需 Node.js 版本：14.x 或更高
- 后端依赖：
  - ws: ^8.13.0
  - dotenv: ^16.0.3
  - winston: ^3.8.2

## 许可证

MIT（与 CRAM 项目相同）
