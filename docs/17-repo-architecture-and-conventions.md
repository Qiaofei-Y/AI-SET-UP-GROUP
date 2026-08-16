# 17 · 仓库架构与工程约定

> 一句话:仓库分四块——`docs/`(产品与工程文档)、`frontend/`(零构建静态站)、`backend/`(目前只有计划)、`figma/`(原型与设计规范);前端的一切约定围绕三条铁律:**零构建零依赖、单一联网文件、全站双语成对**。

## 1. 顶层结构与职责边界

```
AI-SET-UP-GROUP/
├── README.md          文档索引(所有新文档必须在这里登记)
├── CLAUDE.md          AI 协作说明(命令、安全边界、约定摘要)
├── docs/01–19         编号文档:01–08 产品/商业,09 工程任务,10 图表,
│                      11 AI 架构,12–15 商业运营,16 本地 AI 接入,
│                      17 架构约定(本文),18 测试规范,19 安全模型
├── frontend/          可运行的多页静态站(页面清单见 frontend/README.md)
│   ├── *.html         每页一个文件,HTML 只放内容
│   ├── assets/        CSS/JS 按"共享 vs 页面专属 vs 功能"拆分
│   └── tests/         安全测试套件(全仓唯一测试入口)
├── backend/           演进计划 + API v0(零依赖 stdlib;api/server.py、api/registry.json、tests/)
└── figma/             高保真原型 + design-system.md(视觉规范唯一出处)
```

外部依赖(不在仓库内):用户本机的 **llm-lab**(`~/llm-lab`),提供可选的真实模型服务。

## 2. 端口表(全项目统一)

| 端口 | 服务 | 归属 |
|------|------|------|
| 8931 | 前端开发服务器(`python3 -m http.server`) | 本仓库 |
| 8940 | 后端 API v0(`python3 backend/api/server.py`) | 本仓库 |
| 8080 | llama.cpp 聊天模型(OpenAI 兼容) | llm-lab |
| 8081 | bge-m3 向量服务 | llm-lab |
| 8082 | Qwen2.5-Coder(尚未接入网页) | llm-lab |
| 8090 | Michael AI Portal(`/api/rag`) | llm-lab |
| 8092 | **预留顾问端口**——起任意 OpenAI 兼容服务即被 build 向导自动采用 | 用户自定 |

新增端口必须更新本表、`docs/16`、CLAUDE.md 三处。

## 3. 前端三条铁律

1. **零构建、零依赖**:没有 npm、打包器、框架;`<script>`/`<link>`/图片全部本地相对路径。改变这一点是重大架构决策,需先写决策记录(见 §7)。
2. **单一联网文件**:全站只有 `assets/local-llm.js` 允许任何网络 API,且只许指向 `127.0.0.1` 的固定常量(`BASE`/`PORTAL`/`ADVISOR`)。详见 [19 安全模型](19-security-model.md)。
3. **双语成对**:任何用户可见文案必须同时提供中英文(机制见 §5),只提供一种语言的 PR 视为未完成。

## 4. 代码分割与命名约定

- **HTML 只放内容**;样式进 CSS、逻辑进 JS,不写 `<style>` 块(个别单行内联 style 允许,批量样式必须进文件)。
- **CSS**:共享(变量/导航/按钮/页脚/通用组件/动画)→ `base.css`;页面专属 → `{page}.css`。颜色/字体/圆角一律用 `base.css` 的 CSS 变量(`--accent`、`--ink`、`--mono` 等,色值定义见 [figma/design-system.md](../figma/design-system.md)),**禁止硬编码色值**。
- **JS**:按功能一文件(i18n / hero 动画 / 向导 / 聊天 / 连接器),全部用 IIFE 包裹,除 §6 登记的全局钩子外**不得新增 window 全局**。
- 新页面 = 一个 HTML + 加载 `base.css` + 一个页面 CSS(+ 需要时一个页面 JS),并在 `frontend/README.md` 的页面表登记。

## 5. 双语 i18n 机制(assets/i18n.js)

- HTML 元素:`data-en` / `data-zh` 属性存两种文案,`data-en-ph` / `data-zh-ph` 存占位符;元素有子节点时只替换第一个非空文本节点(保住链接/标记)。
- JS 生成的字符串:用全局 `t(en, zh)`。
- 动态渲染的面板**有义务**监听 `langchange` 事件重渲染(参照 build.js / local-llm.js 的做法)。
- 语言状态:`window.__lang`;持久化仅存语言码于 localStorage `bma-lang`(受测试断言约束)。
- 默认英文(面向美国市场),中文是切换项。

## 6. 跨文件全局钩子清单(唯一登记处)

文件之间只通过这些显式接口协作,新增必须登记于此:

| 钩子 | 定义方 | 使用方 | 作用 |
|------|--------|--------|------|
| `window.t(en, zh)` / `window.setLang` / `window.__lang` | i18n.js | 所有 JS | 双语 |
| `langchange` 事件(document) | i18n.js | build.js, local-llm.js | 语言切换后重渲染 |
| `window.__chatLive`(`addAILive(onInterrupt)→{append,done,fail,addCite}`、`toast`) | chat.js | local-llm.js | 把真实模型输出流进聊天 UI |
| `chat-reset` 事件(detail.seed) | chat.js | local-llm.js | 切会话时重置对话历史 |
| `window.LocalLLM`(`ready()`、`ask(q)`) | local-llm.js | chat.js | 聊天页询问真实模型 |
| `window.__buildAdvisor`(`needs`、`select(slug, via)`) | build.js | local-llm.js | 本地 AI 分类结果选中模板卡 |

约定:钩子全部挂 window 或 document 事件,**不互相 import**(没有模块系统);使用方必须容忍钩子不存在(页面可能没加载对方文件)。

## 7. 文档镜像与同步规则

**"文档与演示互为镜像"是本仓库最容易违反的规则**,改动时按此表检查另一侧:

| 改了这里 | 必须检查 |
|----------|----------|
| 首页/营销页文案(模板、能力、部署、价格) | docs/02、04、05 + 向导 build.html 是否口径一致 |
| 向导流程/选项 | 首页宣传区、docs/09 任务表 |
| 连接器 local-llm.js | docs/16、CLAUDE.md 安全边界节 |
| 测试断言数量或规则 | docs/13 §测试、16、18、frontend/tests/README.md 中的计数与描述 |
| 端口 | §2 端口表、docs/16、CLAUDE.md |
| 任何 docs/*.md | llm-lab 在线时 `ai ingest ~/AI-SET-UP-GROUP`(RAG 语料就是这些文档) |
| 新增文档 | README.md 索引表登记 |

## 8. 决策记录(为什么是这样)

- **为什么零构建**:演示站的价值是"双击就能跑 + 任何人能读懂";引入构建链会把非技术协作者挡在门外,且当前规模(约 10 页)完全不需要。触发重新评估的条件:页面间共享组件开始复制粘贴失控,或需要真实前端框架的交互复杂度。
- **为什么单一联网文件**:把"数据不出本机"从口号变成可机器验证的断言——审计面收敛到一个文件,测试按精确路径豁免,防同名文件混入(详见 19)。
- **为什么需求框只写不读(build.js 侧)**:自由文本是攻击者可控输入,隔离在生成链路之外;读框和联网职责收进连接器,自由文本只可能到 127.0.0.1(详见 16 §8、19)。
- **为什么 backend 只有计划没有代码**:见 [backend/README.md](../backend/README.md) 设计原则——数据没证明需要之前不建。
