# AI-SET-UP-GROUP

> 把复杂的开源 AI 世界,变成普通人也能一键拥有的个人 AI。

## 这是什么

一个面向**非技术用户**的「个人 AI 搭建平台」,**目标市场为美国**(所有模型下载源、云服务、支付与分发渠道均使用美国本土资源)。

用户不需要理解模型、GPU、RAG、LoRA、Docker、CUDA,只需要告诉平台:

> "我想让 AI 帮我做什么。"

平台负责把后面的所有技术问题解决掉。

例如用户说:

> "我想搭建一个完全私有的公司知识 AI,可以读取 PDF、Excel 和内部资料。"

系统自动判断适合的开源模型、显存要求、电脑配置、RAG 方案以及是否需要微调,并生成一键安装方案。

## 产品完整流程

```
需求选择 → 设备检测 → AI 推荐方案 → 本地/云端选择 → 自动安装
→ 添加个人知识 → RAG → 使用 → 收集反馈 → 微调 → API/工具接入
```

## 文档索引

> 新协作者从 [ONBOARDING.md](ONBOARDING.md) 开始:15 分钟跑起来、提交门槛、别踩的雷。

| 文档 | 内容 |
|------|------|
| [01 愿景与定位](docs/01-vision.md) | 四阶段愿景、一句话定位、最终形态 |
| [02 产品概览](docs/02-product-overview.md) | 目标用户、完整用户旅程、核心体验 |
| [03 核心模块](docs/03-core-modules.md) | 六大核心模块的详细设计 |
| [04 MVP 范围](docs/04-mvp.md) | 第一版做什么、不做什么、成功标准 |
| [05 商业模式](docs/05-business-model.md) | Free / Pro / Business 分层与其他收入 |
| [06 护城河](docs/06-moat.md) | AI Deployment Intelligence 数据飞轮 |
| [07 路线图](docs/07-roadmap.md) | 阶段性目标与里程碑 |
| [08 资源与链接](docs/08-resources.md) | 美国生态的模型源、运行时、云 GPU、合规资源 |
| [09 MVP 工程任务清单](docs/09-mvp-engineering-tasks.md) | 五个里程碑、可验收的任务拆解、执行顺序 |
| [10 Figma 图表](docs/10-figma-diagrams.md) | 流程图与架构图的 FigJam 链接及源码 |
| [11 AI 架构与模型路由](docs/11-ai-architecture-and-model-routing.md) | 方案顾问用什么 API、本地 vs 云端、隐私边界 |
| [12 商业企划书](docs/12-business-plan.md) | 市场、模式、竞争、运营流程、里程碑与财务 |
| [13 测试与实验](docs/13-validation-testing-and-experiments.md) | 假设验证、可用性测试、Beta 计划、指标、埋点、A/B |
| [14 用户引导与激活](docs/14-user-onboarding-and-activation.md) | 激活漏斗、首次体验、留存、升级引导、FAQ |
| [15 营销手册](docs/15-marketing-playbook.md) | 各渠道广告 + 教程 + 可直接用的英文脚本文案 |
| [16 本地 AI 接入网页](docs/16-local-ai-web-integration.md) | chat.html ↔ llm-lab:本地 RAG + 流式聊天的完整实现说明 |
| [17 仓库架构与工程约定](docs/17-repo-architecture-and-conventions.md) | 目录职责、端口表、前端三铁律、i18n 规则、全局钩子清单、文档镜像规则、决策记录 |
| [18 测试与质量规范](docs/18-testing-and-quality.md) | 测试全景、提交门槛(DoD)、安全断言放宽流程、无头浏览器端到端验证 playbook |
| [19 安全与隐私模型](docs/19-security-model.md) | 威胁模型、不变量→断言映射、需求框数据流、隐私红线、部署 CSP 加固 |
| [20 后端结构与技术文档](docs/20-backend-architecture-and-api.md) | API v0 完整参考:目录结构、分库设计、全部端点规格、schema 白名单、auth/license 实现、红线→断言映射 |
| [21 Lambda 云一键部署集成设计](docs/21-lambda-cloud-integration.md) | Lambda API 调研事实、一键部署 UX/架构/key 安全/bootstrap、端点清单、费用透明、分期与实测清单 |
| [22 商用化差距审计与路线图](docs/22-commercial-readiness-audit.md) | 演示版→商用版全项目审计:17 条 P0 确认清单、P1/P2、资产与演示壳盘点、按依赖排批的执行路线 |
| [23 一个月执行计划](docs/23-one-month-execution-plan.md) | 按周排的商用化落地清单(Stripe 计费、找回/验证邮件、SQLite 生产化、部署与备份),逐条勾对已交付项 |
| [24 批次 2 执行计划](docs/24-batch-2-execution-plan.md) | 付费交付物本体:Tauri 真安装器(P0-8)+ 代码签名、本地 RAG(P0-9)、Control Center 桌面化 + 硬件真检测 + 安装漏斗,按依赖排的可勾选清单 |
| [figma/ 界面原型](figma/) | 7 个 MVP 核心界面的高保真原型(浏览器打开) |
| [frontend/ 可用网站](frontend/) | 营销首页 + 引导流程 + 聊天演示 + 账号中心(account.html)+ 下载页(downloads.html)+ 结账/找回/验证页 |
| [backend/ 后端演进计划 + API v0](backend/) | 分阶段计划、SaaS 选型与自建边界、隐私红线;已含零依赖 API v0(advise/registry/license/telemetry/feedback/auth/billing + 找回/验证发信)与备份脚本(ops/backup.py) |
| [deploy/ 生产部署脚本](deploy/) | 同源反代(Caddyfile / nginx.conf,`/v1/*` 转后端)+ systemd 服务单元与备份 timer |

## 一句话定位

**用户只需要选择"我要一个采购 AI / 公司知识 AI / 研究 AI",然后点击 Build My AI。**
