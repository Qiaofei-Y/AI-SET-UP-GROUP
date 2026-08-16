# backend/ — 后端演进计划

> 一句话:**营销站和产品本体可以长期无后端;账号、支付校验、埋点回收、方案顾问 API 这四样绕不开**——前三样用美国 SaaS 加"胶水级"小服务解决,只有方案顾问与数据飞轮值得认真自建,它们也正是护城河([docs/06](../docs/06-moat.md))所在。
>
> 本目录目前**只有这份计划**。未经计划确认,不要在这里写服务代码。

## 0. 设计原则

1. **产品本体永不依赖我们的服务器。** 用户装好的 AI 全本地运行([docs/04](../docs/04-mvp.md)),断网可用、数据不出设备——这是核心卖点,任何后端设计不得侵蚀它。
2. **能买不建。** 账号、支付、埋点、分发都有成熟的美国 SaaS;自建只留给别人卖不了的东西(顾问推荐引擎、部署数据飞轮)。
3. **数据驱动上线时机。** 每个阶段有明确的触发条件(见各节),漏斗数据没到就不动工——避免给 0 用户的产品修水坝。
4. **隐私边界白纸黑字。** 用户文档、聊天内容、知识库**永不上传**;上传的只有匿名化的部署遥测(机型档位/模型选择/安装成败),且 opt-in([docs/13 §埋点](../docs/13-validation-testing-and-experiments.md))。

## 1. 阶段总览

| 阶段 | 触发条件 | 要解决什么 | 自建量 |
|------|----------|-----------|--------|
| P0 现状 | — | 演示与获客 | 零后端 |
| P1 Beta 验证 | 网站上线、开始拉新 | 埋点、邮箱、反馈、安装包分发 | 零自建(纯 SaaS) |
| P2 账号与收费 | 激活漏斗跑通(≥50 人走完 安装→首答)| 注册登录、支付、license 校验 | 第一个小 API |
| P3 护城河 | 付费转化验证(≥10 个付费)| 方案顾问 API、模型库、数据飞轮、Teach My AI 回收 | 核心自建 |

## 2. P1 · Beta 验证(零自建,全部美国 SaaS)

| 需求 | 选型 | 说明 |
|------|------|------|
| 埋点/漏斗 | PostHog Cloud(US) | [docs/13](../docs/13-validation-testing-and-experiments.md) 的激活漏斗与 A/B 全靠它;前端加一段脚本即可 |
| 邮箱收集 | Formspree / Buttondown | signup.html 的表单从"假提交"改为真收邮箱 |
| 反馈回收 | PostHog capture 或 Tally 表单 | chat 演示页的 👍/👎 先落到这里 |
| 安装包分发 | GitHub Releases / Cloudflare R2 | 静态文件,带下载计数 |
| 网站托管 | Cloudflare Pages / Vercel | 纯静态,顺带拿到访问日志与 CSP 响应头(见 [frontend/tests/README.md](../frontend/tests/README.md) 的 CSP 建议) |

⚠ 接 PostHog 时会触碰前端安全边界(全站只许 `local-llm.js` 联网、无外部资源)——届时需**有意识地放宽** `frontend/tests/security.test.js` 的断言:把 PostHog 域名列入显式白名单,而不是删掉检查。

## 3. P2 · 账号与收费(第一个自建小 API)

| 需求 | 选型 | 说明 |
|------|------|------|
| 注册/登录 | Clerk 或 Supabase Auth | signup.html 已区分 Free(免注册)/ Pro / Business(收公司名),照 [docs/05](../docs/05-business-model.md) 分层 |
| 支付 | Stripe(Payment Links 起步)| 免代码收款;正式后换 Checkout + Webhook |
| license 校验 | **自建小 API**(第一个) | 安装器/Control Center 激活 Pro 功能时验一次 license;离线宽限期设计,不能让断网用户被锁 |

**自建 API 形态**:单体小服务即可——TypeScript(Hono/Fastify)或 Python(FastAPI),Postgres(Supabase/Neon),部署 Fly.io / Railway / AWS us-east-1。此阶段唯一端点:

```
POST /v1/license/verify   { license_key, device_fingerprint } → { valid, tier, grace_until }
```

## 4. P3 · 护城河(核心自建)

这是 [docs/06](../docs/06-moat.md) 的 AI Deployment Intelligence 飞轮,也是 [docs/11](../docs/11-ai-architecture-and-model-routing.md) 里"方案顾问用云端 API"的服务端:

| 服务 | 作用 | 接口草案 |
|------|------|----------|
| 方案顾问 API | 自由文本需求 + 硬件档位 → 推荐方案(接大模型 + 规则表);替换 frontend 的规则版推荐和本地分类器 | `POST /v1/advise { need_text, hardware } → { template, model, rag, mode, why }` |
| 模型库 Registry | 持续测试/收录开源模型的 license、显存、量化、兼容性;演示站与安装器拉取更新 | `GET /v1/registry/models?vram=12` |
| 部署遥测(opt-in) | 匿名回收 装机成败/机型档位/所选模型 → 反哺推荐准确率 | `POST /v1/telemetry/deploy` |
| Teach My AI 回收 | 👍/👎 与纠正样本的聚合统计(**内容不上传**,只传结构化标注)| `POST /v1/feedback` |

**与本地体验的关系**:顾问 API 只在"网页向导/安装前"使用;装好之后的一切推理仍在用户本机。frontend 预留的 `ADVISOR :8092` 端口(见 [docs/16 §8](../docs/16-local-ai-web-integration.md))与此并行——本地有顾问模型就用本地的,没有才走云端 API,顺序永远是 本地优先。

## 5. 隐私边界(所有阶段不变)

| 永不上传 | 可上传(opt-in + 匿名) |
|----------|------------------------|
| 用户文档 / 知识库内容 | 硬件档位(GPU 型号段、显存档) |
| 聊天问题与回答原文 | 模板/模型选择、安装成败与耗时 |
| 文件名、目录结构 | 👍/👎 标注(不含消息内容) |

## 6. 里程碑清单

- [ ] P1:网站上线 SaaS 埋点 + 真实邮箱收集(触发:开始投放)
- [ ] P1:安装包走 GitHub Releases,带下载计数
- [ ] P2:Stripe Payment Links + Clerk 注册(触发:漏斗 ≥50 人完成激活)
- [ ] P2:license 校验 API 上线(第一个自建服务)
- [ ] P3:方案顾问 API 替换规则版推荐(触发:≥10 个付费用户)
- [ ] P3:模型库 Registry + 部署遥测闭环(飞轮起转)
