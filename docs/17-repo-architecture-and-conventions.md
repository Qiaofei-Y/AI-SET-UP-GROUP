# 17 · 仓库架构与工程约定

> 一句话:仓库分四块——`docs/`(产品与工程文档)、`frontend/`(零构建静态站)、`backend/`(演进计划 + 零依赖 API v0)、`figma/`(原型与设计规范);前端的一切约定围绕三条铁律:**零构建零依赖、单一联网文件、全站双语成对**。

## 1. 顶层结构与职责边界

```
AI-SET-UP-GROUP/
├── README.md          文档索引(所有新文档必须在这里登记)
├── CLAUDE.md          AI 协作说明(命令、安全边界、约定摘要)
├── ONBOARDING.md      新成员上手指南(跑起来、门槛、别踩的雷)
├── docs/01–21         编号文档:01–04 愿景/产品/模块/MVP,06 持久价值,
│                      07 路线图,08 资源,09 工程任务,10 图表,11 AI 架构,
│                      13 验证与实验,14 引导与激活,15 社区推广,16 本地 AI 接入,
│                      17 架构约定(本文),18 测试规范,19 安全模型,
│                      20 后端技术参考,21 Lambda 云部署设计
│                      (05/12/22/23/24 为已删除的商业化文档,编号留空不复用)
├── frontend/          可运行的多页静态站(页面清单见 frontend/README.md)
│   ├── *.html         每页一个文件,HTML 只放内容
│   ├── assets/        CSS/JS 按"共享 vs 页面专属 vs 功能"拆分
│   └── tests/         前端安全测试套件(静态断言 + XSS 实测 + UI 冒烟)
├── backend/           演进计划 + API v0(零依赖 stdlib;api/server.py、api/mailer.py、api/registry.json、ops/backup.py、tests/)
├── deploy/            生产部署脚本(同源反代 Caddyfile/nginx.conf + systemd 单元 + 备份 timer + 运行手册)
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
| 11434 | Ollama(引导安装包装的引擎,OpenAI 兼容 `/v1`)——聊天页的回退档 | 用户自装 |

新增端口必须更新本表、`docs/16`、CLAUDE.md 三处。

## 3. 前端三条铁律

1. **零构建、零依赖**:没有 npm、打包器、框架;`<script>`/`<link>`/图片全部本地相对路径。改变这一点是重大架构决策,需先写决策记录(见 §7)。
2. **单一联网文件**:全站只有 `assets/local-llm.js` 允许任何网络 API;`BASE`/`PORTAL`/`ADVISOR` 钉死 `127.0.0.1`,`API` 是锁形条件式(本地页 `127.0.0.1:8940`,部署页同源相对 `''`,同源部署)。详见 [19 安全模型](19-security-model.md)。
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
| `window.__buildAdvisor.planProvider(req, cb)` | local-llm.js 注册 | build.js 调用 | 方案步骤向后端 `/v1/advise` 要实时推荐 |
| `window.__buildAdvisor.reportPlan(payload)` | local-llm.js 注册 | build.js 调用 | "生成文件"上报 `/v1/telemetry/deploy`(slug/档位/布尔,fire-and-forget) |
| `chat-feedback` 事件(detail.rating) | chat.js | local-llm.js | 👍/👎 转发到后端 `/v1/feedback`(仅评分,无内容) |
| `window.__bmaAuth`(`signup/login/me/logout`、`forgot/reset/verify`、`changePassword/changeEmail/logoutAll/exportData/deleteAccount`) | local-llm.js | signup.js, dashboard.html, account.js, auth-recovery.js, auth-nav.js | 注册/登录/登录态 + 找回验证 + 账号自助走后端 `/v1/auth/*` 与 `/v1/account/*`(唯一联网文件代发);账号可选,用于同步/找回,非付费墙 |
| `window.__bmaConsent`(`get()`、`set(bool)`) | local-llm.js | build.js(向导勾选框), dashboard.html, account.js(匿名统计开关) | 设备级匿名统计 opt-in 开关(存 localStorage `bma-usage-consent`,默认关);`reportPlan`/`chat-feedback` 外发前均门控 `consented()` |
| `window.FX.decode(el)` + `data-fx` 根属性 | fx.js | 页面标记 / 测试 | 文字解码动效;`data-fx="on"` 是动效层初始化完成的测试锚点 |

约定:钩子全部挂 window 或 document 事件,**不互相 import**(没有模块系统);使用方必须容忍钩子不存在(页面可能没加载对方文件)。

## 7. 文档镜像与同步规则

**"文档与演示互为镜像"是本仓库最容易违反的规则**,改动时按此表检查另一侧:

| 改了这里 | 必须检查 |
|----------|----------|
| 首页/营销页文案(模板、能力、部署) | docs/02、04 + 向导 build.html 是否口径一致 |
| 向导流程/选项 | 首页宣传区、docs/09 任务表 |
| 连接器 local-llm.js | docs/16、CLAUDE.md 安全边界节 |
| 测试断言数量或规则 | docs/13 §测试、16、18、frontend/tests/README.md 中的计数与描述 |
| 端口 | §2 端口表、docs/16、CLAUDE.md |
| 后端 server.py / 端点 | docs/20(端点规格、env 表、测试数)、backend/README 状态表、CLAUDE.md |
| 动效层 fx.css / fx.js | figma/design-system.md 动效节、§6 钩子清单、ui.smoke 的锚点约定 |
| 任何 docs/*.md | llm-lab 在线时 `ai ingest ~/AI-SET-UP-GROUP`(RAG 语料就是这些文档) |
| 新增文档 | README.md 索引表登记 |

## 8. 决策记录(为什么是这样)

- **为什么零构建**:演示站的价值是"双击就能跑 + 任何人能读懂";引入构建链会把非技术协作者挡在门外,且当前规模(约 21 页)完全不需要。触发重新评估的条件:页面间共享组件开始复制粘贴失控,或需要真实前端框架的交互复杂度。
- **为什么单一联网文件**:把"数据不出本机"从口号变成可机器验证的断言——审计面收敛到一个文件,测试按精确路径豁免,防同名文件混入(详见 19)。
- **为什么需求框只写不读(build.js 侧)**:自由文本是攻击者可控输入,隔离在生成链路之外;读框和联网职责收进连接器,自由文本只可能到 127.0.0.1(详见 16 §8、19)。
- **为什么 API 常量是锁形条件式而非构建时注入**(2026-08-25 拍板同源部署):零构建约束下没有环境变量/构建期注入点;`LOCAL_PAGE ? 回环字面量 : ''` 让同一份静态文件本地与生产免配置通用,且安全断言能把 API 的可能取值锁到只有两种(回环、同源相对)——比"部署时手改常量"更不可能出错。备选"部署脚本 sed 替换"被否:引入了构建步骤且断言无法锁住产物。
- **为什么 backend 长期只有计划、v0 也保持零依赖**:数据没证明需要之前不建(见 [backend/README.md](../backend/README.md) 设计原则);2026-08 决策提前动工的 API v0 沿用前端同一哲学(纯 stdlib、单文件、易审计),上线时机仍按各阶段触发条件。
