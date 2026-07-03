# 多模态文件处理助手

基于 Claude Agent SDK 构建、部署在 EdgeOne Makers 上的 AI 文档处理 Agent，支持图片、PDF、CSV、Word、Excel、文本等多种文件的分析与交互式操作。

**Framework:** Claude Agent SDK · **Category:** File Processing · **Language:** TypeScript

[![部署到 EdgeOne Makers](https://cdnstatic.tencentcs.com/edgeone/pages/deploy.svg)](https://edgeone.ai/makers/new?template=multimodal-file-assistant-agent&from=within&fromAgent=1&agentLang=typescript)

## 概述

本模板将上传的文件转化为可操作的洞察与转换输出。它自动识别文件类型并加载对应的处理技能，在安全沙箱中运行 Python 与 Shell 命令，并将生成文件交付给用户。双 MCP 服务器架构同时向 AI Agent 暴露沙箱工具（代码解释器、命令、文件 I/O）与自定义 UI 工具（操作建议、文件交付）。

- **基于技能的分析** — 根据文件类型动态加载专用技能（图片、CSV、PDF、Word、Excel、文本），定制系统提示与可用操作。
- **沙箱执行** — 在 EdgeOne 沙箱中运行 Python（Pillow、pandas、matplotlib、pdfplumber、python-docx）与 Shell 命令（ffprobe、ffmpeg），凭证由平台自动注入。
- **交互式操作** — 分析完成后，Agent 通过 `suggest_actions` 自定义工具展示可点击的操作卡片；处理后的文件通过 `deliver_file` 以 base64 下载链接交付。
- **会话文件缓存** — 同一对话内的上传文件通过进程内缓存跨请求保留，每轮自动重新写入沙箱。
- **双语界面** — 完整中 / 英界面，AI 输出根据语言环境自动适配。

## 环境变量

| 变量 | 必填 | 说明 |
|----------|----------|-------------|
| `AI_GATEWAY_API_KEY` | 是 | 模型网关 API Key。使用 Makers Models 的 API Key，或任何兼容 OpenAI 协议的提供商 Key。 |
| `AI_GATEWAY_BASE_URL` | 是 | 网关基础地址。使用 Makers Models 时填写 `https://ai-gateway.edgeone.link/v1`。 |
| `AI_GATEWAY_MODEL` | 否 | 模型 ID，默认为 `@makers/deepseek-v4-flash`。 |

本模板遵循 OpenAI 兼容标准 —— 可指向 Makers Models 或任何兼容提供商。

### 如何获取 AI_GATEWAY_API_KEY

1. 打开 Makers 控制台（https://edgeone.ai/makers/new?s_url=https://console.tencentcloud.com/edgeone/makers）
2. 登录并启用 Makers
3. 进入 Makers → Models → API Key，创建 Key
4. 将其填入 `AI_GATEWAY_API_KEY`

> 内置模型在额度内免费，适合验证；生产环境请绑定自费厂商 Key（BYOK）。

## 本地开发

**前置依赖**
- Node.js 18+
- EdgeOne CLI（`npm i -g edgeone`）

```bash
npm install
cp .env.example .env
# 编辑 .env，填入 AI_GATEWAY_API_KEY 与 AI_GATEWAY_BASE_URL
edgeone makers dev
```

本地可观测面板地址：http://localhost:8088/agent-metrics。

## 项目结构

```
multimodal-file-assistant-agent/
├── agents/
│   ├── chat/
│   │   ├── index.ts       # POST /chat —— 主 Agent：会话管理、文件上传、SSE 循环
│   │   ├── _skills.ts     # 按文件类型构建动态系统提示
│   │   ├── _templates.ts  # PDF 生成模板（支持 CJK 字体）
│   │   └── _tools.ts      # Shell 引号、文件内联降级、默认操作
│   ├── stop/
│   │   └── index.ts       # POST /stop —— 中止运行
│   ├── _model.ts          # 模型名称解析、网关环境变量映射
│   └── _shared.ts         # SSE 辅助函数、日志
├── cloud-functions/
│   ├── health/
│   │   └── index.ts       # GET /health —— 存活探针
│   └── _logger.ts         # 云函数共享日志工具
├── app/                   # Next.js App Router 前端
├── lib/
│   └── i18n.tsx           # 中 / 英翻译
└── edgeone.json           # EdgeOne 部署配置
```

以 `_` 为前缀的文件是私有模块，不会作为公共路由暴露。

## 工作原理

### 运行模式
`agents/` 下的文件以**会话模式**运行：相同 `conversation_id` 的请求会被粘性路由到同一 Agent 实例及同一沙箱。这保证了上传文件与沙箱状态在后续消息中始终可用。

### 端到端流程

1. **文件上传** —— 前端将文件编码为 base64，POST `/chat`：HTTP Header 带 `makers-conversation-id`，请求体 `{ message, files }`。
2. **会话缓存** —— 文件被合并到按会话划分的进程内缓存，确保在后续追问中不丢失。
3. **写入沙箱** —— 处理器将缓存文件通过 base64 解码（Shell `base64 -d` 或 Python 降级策略）写入 EdgeOne 沙箱的 `/tmp/` 目录。
4. **技能选择** —— 根据上传文件类型（图片、CSV、PDF、Word、Excel、文本或混合）动态构建系统提示，仅加载相关技能指令。
5. **Agent 循环** —— Claude Agent SDK 的 `query()` 循环驱动 LLM，同时挂载两个 MCP 服务器：
   - **EdgeOne 沙箱 MCP**（`context.tools.toClaudeMcpServer()`）暴露 `code_interpreter`、`commands` 与文件 I/O 工具。
   - **自定义工具 MCP** 暴露 `suggest_actions`（UI 操作卡片）与 `deliver_file`（可下载输出）。
6. **工具执行** —— AI 可运行 Python 进行数据分析、Shell 命令进行媒体处理，或读写沙箱文件。
7. **SSE 流式输出** —— 事件包括 `text_delta`（助手文本）、`tool_called`（工具启动）、`code_output` / `code_error`（执行结果）、`suggest_actions`（可点击选项）与 `file_output`（base64 下载）。
8. **降级处理** —— 若沙箱不可用，文本文件直接内联到提示中；二进制文件被跳过并提示用户。

### 关键路由与参数
- `/chat` —— 主处理端点。Header：`makers-conversation-id: <uuid>`；Body：`{ message, files[] }`。
- `/stop` —— 取消某对话的活跃查询运行。Body：`{ conversation_id: <uuid> }`（**不要带 `makers-conversation-id` Header**，否则会粘性路由到正在执行的 chat 实例，abort 失效）。
- `/health` —— 简单的存活探针（位于 `cloud-functions/`，不涉及 AI）。
- `conversation_id` 由前端生成（`crypto.randomUUID()`），通过 `makers-conversation-id` Header 传入；运行时会自动绑定到 `context.conversation_id`。

### 超时配置
未自定义 Agent 超时，使用平台默认值。

## 相关资源

- [Makers Agents 文档](https://cloud.tencent.com/document/product/1552/132759)
- [Makers 快速开始](https://cloud.tencent.com/document/product/1552/132786)
- [Makers Models](https://cloud.tencent.com/document/product/1552/132748)

## 许可证

MIT
