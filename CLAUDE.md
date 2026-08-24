# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 这个仓库是什么

「Build My AI」——面向非技术用户的个人 AI 搭建平台。当前阶段是**产品文档 + 可运行的演示站 + 零依赖后端 API v0**(前端离线可独立运行,后端在线时自动增强):

- `docs/01–19`:产品与工程文档(`README.md` 有索引)。工程侧必读:**17 架构与约定**(全局钩子清单、文档镜像规则)、**18 测试规范**(提交门槛、断言放宽流程、端到端验证 playbook)、**19 安全模型**(不变量→断言映射)。
- `frontend/`:多页静态网站(营销页 + 引导向导 + Control Center + 聊天演示)。**零构建、零依赖**——没有 npm/打包器,双击或起个静态服务器即可运行。
- `backend/`:演进计划(`backend/README.md`)+ **API v0**(`api/server.py`,零依赖 stdlib):advise/registry/license/telemetry/feedback 五端点,隐私红线是 schema 白名单 + 测试断言(自由文本一律 400,`need_text` 不落盘)。**前端已接入**(API 在线时:向导方案走 `/v1/advise`、生成文件上报 `/v1/telemetry/deploy`、聊天 👍/👎 上报 `/v1/feedback`;离线自动回退纯前端)。
- `figma/`:高保真界面原型(`prototype.html` 浏览器打开)与设计系统说明。

硬性约束:**项目面向美国市场**(模型源/云服务/支付渠道一律用美国资源),但**文档语言保持中文**;网站 UI 默认英文、可切中文。

## 常用命令

```bash
# 安全测试(唯一的测试套件;任一失败退出码 1,可作 pre-commit)
bash frontend/tests/run.sh              # 静态+单元测试(node,零依赖)+ 无头 Chrome XSS 实测(无 Chrome 自动跳过)
node frontend/tests/security.test.js    # 只跑静态+单元部分(89 项,含 pickModel↔registry 同步校验)

# 本地跑网站(chat.html 的 fetch 在 file:// 下被禁,必须走 http://)
cd frontend && python3 -m http.server 8931
open http://localhost:8931/chat.html

# 后端 API v0(零依赖 stdlib,127.0.0.1:8940)
python3 backend/api/server.py            # 启动
python3 backend/api/server.py --mint pro # 铸造演示 license
python3 backend/tests/api.test.py        # 后端测试(26 项,起真实服务)
# 可选:BMA_ADVISOR_LLM=http://127.0.0.1:8080 让 /v1/advise 用本地 LLM 分类(仅回环,失败回退规则)

# 可选:接真实本地模型(llm-lab,在 ~/llm-lab)
ai                                 # 启动:8080 聊天模型 / 8081 向量 / 8090 RAG 门户(8092 为预留顾问端口,用户可自行起服务)
ai ingest ~/AI-SET-UP-GROUP        # 文档改动后增量更新 RAG 索引(已入库文件——含 README——都会自动查新)
# 新增 README 需显式入库一次(目录扫描按 llm-lab 约定跳过 README),之后目录命令即可刷新:
# ai ingest ~/AI-SET-UP-GROUP/<路径>/README.md
ai reindex ~/AI-SET-UP-GROUP       # 彻底重建索引
```

## 安全边界(由测试强制,改代码前必读)

`frontend/tests/security.test.js` 把安全模型写成了断言,违反即测试失败:

- **全站只有 `frontend/assets/local-llm.js`(按精确路径豁免)允许发网络请求**;其他任何文件出现 `fetch/XHR/WebSocket/EventSource/sendBeacon/new Image(/import(` 都会挂。
- 连接器内 `BASE`(8080)/`PORTAL`(8090)/`ADVISOR`(8092,预留)/`API`(8940,自建后端)必须各只赋值一次、指向 `127.0.0.1`;每个 `fetch` 必须以四者之一开头;不允许出现其他 URL 字面量。
- `build.js` 永远不读需求框的值(write-only 预填);需求框文本只由 `local-llm.js` 读取并发往 `127.0.0.1` 做分类,绝不进入生成的安装包/手册。
- 用户输入/模型输出一律 `esc()` + `textContent` 渲染,禁止进原始 `innerHTML`;禁 `eval`/`document.write`/`insertAdjacentHTML`/字符串定时器。
- 所有 `<script>`/`<link>`/图片必须是本地相对路径(纯静态站无外部资源)。

新增页面或 JS 时,先想清楚是否触碰以上任何一条;需要放宽时同步改测试并说明理由。

## 架构要点

**代码分割约定**(`frontend/README.md` 有完整表):HTML 只放内容;共享样式进 `assets/base.css`,页面专属样式一页一个 CSS;JS 按功能拆文件。加新页面 = `base.css` + 一个页面 CSS。

**双语 i18n**(`assets/i18n.js`):HTML 元素用 `data-en`/`data-zh` 属性(占位符用 `data-en-ph`/`data-zh-ph`),JS 生成的字符串用全局 `t(en, zh)`;当前语言在 `window.__lang`,切换派发 `langchange` 事件。**任何新增的可见文案都必须成对提供中英文。**

**聊天页三档模式**(`chat.html`,详见 `docs/16`):`chat.js` 负责 UI 并暴露 `__chatLive` 接口;`local-llm.js` 加载时探测本机 llm-lab,按可用性走阶梯——① 项目 RAG(8080+8090 都在,回答带引用卡,检索不到自动降级)→ ② 通用流式聊天(仅 8080,SSE,最近 12 条上下文)→ ③ 静态演示(内置小样本答案)。断线每 15 秒重探。

**打断语义是连接器最易错的部分**:每个请求持独立 `AbortController` + 全局代数计数器 `gen`,过期请求的一切异步收尾都要先判 stale 才能碰共享状态;用户打断时同步提交半截回答进历史、没流出内容就删掉悬空 user 轮,保证 messages 永远是干净交替。改 `local-llm.js` 的请求生命周期前先读 `docs/16-local-ai-web-integration.md` 第 4 节。

**文档与演示互为镜像**:网站的文案/流程/定价要和 `docs/`(尤其 02、04、05、11)一致,界面风格与 `figma/design-system.md` 一致;改一侧时检查另一侧是否需要同步。RAG 演示的语料就是本仓库的 `.md` 文档,文档改后记得 `ai ingest`。
