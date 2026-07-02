# Interview Helper 面试助手

Interview Helper 是一个本地运行的技术面试辅助工具。它可以采集实时音频，通过讯飞实时语音转写生成现场文字记录，再把面试官的问题交给 DeepSeek，生成适合面试场景的简洁回答。

这个版本已经针对实际部署和面试使用做了修复：

- DeepSeek 通过后端代理请求，避免浏览器 CORS 问题。
- 支持讯飞实时语音转写大模型，需要配置 APPID、APIKey、APISecret。
- 支持浏览器麦克风录音。
- 支持通过屏幕共享采集会议声音，适合腾讯会议、Zoom、浏览器会议等场景。
- 支持自动识别面试官问题并触发 DeepSeek 回答。
- 支持手动输入问题并发送给 DeepSeek。
- 内置候选人简历和项目背景，回答会更贴合计算机、AI、后端、网络、移动端和实时通信相关问题。
- 底部操作栏已固定高度，避免录音状态变化时页面跳动。

## 功能特性

- 实时语音转文字
- 面试官 / 候选人文字记录展示
- AI 回答面板，支持 Markdown 渲染
- 手动输入面试问题
- 会议音频模式：用于采集腾讯会议、Zoom、浏览器标签页等声音
- 麦克风模式：用于本地语音测试
- DeepSeek API 配置页面
- 讯飞实时转写配置页面
- FastAPI 后端、PostgreSQL 数据库、Redis 缓存
- 登录、注册和会话接口

## 技术栈

前端：

- React 19
- TypeScript
- Vite
- Ant Design
- Zustand
- Web Audio API

后端：

- FastAPI
- PostgreSQL
- Redis
- SQLAlchemy
- JWT 认证
- httpx，用于代理 DeepSeek 兼容的 Chat Completions 接口

外部服务：

- DeepSeek Chat API
- 讯飞实时语音转写大模型 WebSocket API

## Docker 快速启动

推荐使用完整 Docker Compose 配置启动：

```bash
docker compose -f docker-compose.full.yml up --build -d
```

默认服务地址：

| 服务 | 地址 / 端口 |
| --- | --- |
| 前端 | http://localhost:5173 |
| 后端 API | http://localhost:9000 |
| Swagger 文档 | http://localhost:9000/docs |
| PostgreSQL | localhost:5462 |
| Redis | localhost:6389 |

查看容器：

```bash
docker ps
```

代码修改后重启：

```bash
docker restart ai-interview-backend-full ai-interview-frontend-full
```

查看日志：

```bash
docker logs -f ai-interview-backend-full
docker logs -f ai-interview-frontend-full
```

## 默认账号

原项目初始化脚本中包含默认测试账号：

```text
username: test
password: test1234
```

如果数据库中没有这个账号，可以进入后端容器执行初始化脚本，或者在应用页面注册新账号。

## 应用配置

打开设置页：

```text
http://localhost:5173/settings
```

需要在页面里配置 DeepSeek 和讯飞实时转写。

### DeepSeek 配置

推荐填写：

```text
API Key: 你的 DeepSeek API Key
API Base URL: https://api.deepseek.com
Model: deepseek-chat
Temperature: 0.3 到 0.7
Max Tokens: 2000
```

请求链路：

```text
前端 -> 后端 /api/ai/chat/completions -> DeepSeek API
```

这样浏览器不会直接请求 DeepSeek，可以避免 CORS 问题。

### 讯飞实时转写配置

使用讯飞开放平台的“实时语音转写大模型”服务。

控制台地址：

```text
https://console.xfyun.cn/services/new_rta
```

需要填写：

```text
APPID
APIKey
APISecret
```

当前代码使用的 WebSocket 地址：

```text
wss://office-api-ast-dx.iflyaisol.com/ast/communicate/v1
```

不要把真实 API 密钥提交到仓库。建议通过应用设置页保存，或者只放在本地环境变量中。

## 会议音频使用方法

在线面试时建议选择 `Meeting audio` 模式。

1. 打开面试页面。
2. 底部下拉框选择 `Meeting audio`。
3. 点击 `Start interview`。
4. 浏览器会弹出屏幕、窗口或标签页共享选择框。
5. 选择包含会议声音的窗口或标签页。
6. 在共享弹窗里勾选或开启“共享音频”。
7. 面试官说话后，右侧会显示实时文字记录。
8. 检测到面试官问题后，系统会自动请求 DeepSeek 生成回答。

注意：

- Chrome / Edge 这类 Chromium 浏览器通常对标签页音频共享支持最好。
- 一些桌面会议软件不一定能被浏览器屏幕采集拿到声音。
- 如果桌面客户端声音采集不到，可以尝试用浏览器加入会议，然后共享该浏览器标签页。
- 如果要排查 ASR 是否正常，先切换到 `Microphone` 模式测试。

## 面试使用流程

1. 登录系统。
2. 新建或进入面试页面。
3. 设置岗位、语言和地区。
4. 选择 `Meeting audio` 或 `Microphone`。
5. 点击 `Start interview`。
6. 右侧显示实时转写内容。
7. 面试官问题会自动触发 DeepSeek。
8. 也可以在底部输入框手动输入问题，点击 `Send`。
9. AI 回答会显示在主面板。

## 候选人背景

本版本包含本地候选人背景文件：

```text
frontend/src/data/candidateContext.ts
```

它会帮助 DeepSeek 回答简历和项目相关问题，包括：

- 密码攻击检测与隐私训练平台
- CrossNotify 跨设备即时提醒系统

该文件没有包含手机号、邮箱等私人联系方式。

如果需要修改候选人背景，编辑该文件后重新构建并重启前端：

```bash
docker exec ai-interview-frontend-full npm run build
docker restart ai-interview-frontend-full
```

## 本地开发

### 前端

```bash
cd frontend
npm install
npm run dev
```

构建前端：

```bash
cd frontend
npm run build
```

### 后端

```bash
cd backend
pip install -r requirements.txt
python run_server.py
```

Windows 专用启动方式：

```bash
cd backend
python run_server_windows.py
```

## 环境变量

后端示例：

```env
DATABASE_URL=postgresql://postgres:root@localhost:5462/ai_interview_helper
REDIS_URL=redis://localhost:6389
SECRET_KEY=change-this-in-production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
CORS_ORIGINS=["http://localhost:5173", "http://localhost:3000"]
```

前端示例：

```env
VITE_API_BASE_URL=http://localhost:9000
```

也支持用环境变量提供讯飞配置，但更推荐在设置页填写：

```env
VITE_XFYUN_APPID=your_app_id
VITE_XFYUN_API_KEY=your_api_key
VITE_XFYUN_API_SECRET=your_api_secret
```

## 主要接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/health` | 后端健康检查 |
| POST | `/api/auth/login` | 登录 |
| POST | `/api/auth/register` | 注册 |
| GET | `/api/auth/me` | 获取当前用户 |
| GET/POST | `/api/sessions/` | 面试会话 |
| GET/POST | `/api/sessions/{id}/messages` | 会话消息 |
| POST | `/api/ai/chat/completions` | DeepSeek 兼容聊天补全代理 |

API 文档：

```text
http://localhost:9000/docs
http://localhost:9000/redoc
```

## 常见问题

### DeepSeek 没有回答

检查：

- 设置页是否已经填写 DeepSeek API Key。
- API Base URL 是否为 `https://api.deepseek.com`。
- 后端是否运行在 `9000` 端口。
- 浏览器是否能访问 `http://localhost:9000/health`。
- 后端日志里是否有上游 API 报错。

常用命令：

```bash
docker logs -f ai-interview-backend-full
docker restart ai-interview-backend-full
```

### 实时转写几秒后停止

检查：

- 讯飞 APPID、APIKey、APISecret 是否来自 `new_rta` 服务页面。
- 讯飞控制台是否还有可用时长或额度。
- 浏览器是否允许麦克风或屏幕音频权限。
- 会议音频模式下，共享弹窗是否开启了音频共享。
- 先用 `Microphone` 模式测试，确认不是 ASR 配置问题。

### 会议音频没有声音

可以尝试：

- 用浏览器标签页加入会议，然后共享该标签页并勾选音频。
- 使用 Chrome 或 Edge。
- 检查系统声音是否静音。
- 切换到 `Microphone` 模式，确认实时转写服务本身正常。

### 底部操作栏大小变化

本版本已经固定底部栏高度，并对长状态文本做省略显示。如果仍然看到旧样式，重新构建后在浏览器里强制刷新：

```text
Ctrl + F5
```

## 安全说明

- 不要提交真实 DeepSeek 或讯飞密钥。
- 如果密钥曾经出现在公开日志或提交记录里，建议立即重置。
- 当前后端 AI 代理会从前端请求体接收 API Key，适合本地个人使用；如果要部署给多人使用，建议把供应商密钥迁移到后端环境变量，并增加用户级权限控制。
- 生产环境部署前必须修改 `SECRET_KEY`。

## 仓库地址

```text
https://github.com/mengqixi/interview-helper
```

## 许可证

本项目遵循上游项目许可证；如仓库所有者另行指定，以仓库中的许可证文件为准。
