# backend/ — 后端演进计划与 API v0

> 一句话:**营销站和产品本体可以长期无后端;账号、支付校验、埋点回收、方案顾问 API 这四样绕不开**——前三样用美国 SaaS 加"胶水级"小服务解决,只有方案顾问与数据飞轮值得认真自建,它们也正是护城河([docs/06](../docs/06-moat.md))所在。

## 当前状态:API v0 已动工(2026-08-16,决策人拍板提前启动)

计划里 P2/P3 草拟的端点已有**零依赖参考实现**(纯 Python 标准库,与前端同一哲学:无包管理器、随处可跑、易审计):

```bash
python3 backend/api/server.py              # 127.0.0.1:8940
python3 backend/api/server.py --mint pro   # 铸造演示 license
python3 backend/tests/api.test.py          # 31 项测试(起真实服务打真实 HTTP)
```

| 端点 | 状态 | 说明 |
|------|------|------|
| `GET /v1/health` | ✅ v0 | 存活探测 |
| `POST /v1/advise` | ✅ v0 规则版 + LLM opt-in | 关键词分类 + 显存档位选模型,镜像 frontend 规则;设 `BMA_ADVISOR_LLM=http://127.0.0.1:8080` 可换用本地 LLM 分类(**仅接受回环地址**,超时/垃圾输出/服务不在一律回退规则,响应带 `advisor: client\|llm\|rules`);`need_text` 只在内存处理,不落日志/库/回显 |
| `GET /v1/registry/models` | ✅ v0 | 数据文件 `api/registry.json` 驱动(与 frontend `pickModel` 保持同步) |
| `POST /v1/license/verify` | ✅ v0 | HMAC 签名 key、无状态、72h 离线宽限;密钥用 `BMA_LICENSE_SECRET` 注入 |
| `POST /v1/telemetry/deploy` | ✅ v0 | 字段白名单(枚举/整数/布尔),未知字段与自由文本一律 400,落 SQLite |
| `POST /v1/feedback` | ✅ v0 | 同上;**没有任何 content 字段,结构上收不了内容** |
| `POST /v1/auth/signup` `login` `logout` + `GET /v1/auth/me` | ✅ v0 自建 | 真实用户表:**身份与遥测分库**(`users.db` / `events.db` 文件级隔离,匿名承诺可审计);密码 PBKDF2-HMAC-SHA256 盐哈希、session 只存 token 的 sha256,库泄露也拿不到密码/凭证;邮箱唯一(不区分大小写),登录失败恒定 401 不区分「邮箱不存在/密码错」 |

**前端已接入**(实现见 [docs/16 §9](../docs/16-local-ai-web-integration.md)):API 在线时,向导"推荐方案"走 `/v1/advise` + registry(方案卡带实时标识,生成文件与之一致);点"生成文件"上报 `/v1/telemetry/deploy`(`stage:'plan_generated'`,与真实安装结果区分——飞轮种子数据);聊天 👍/👎 上报 `/v1/feedback`(仅 评分+模板+模型 id,仅在真实本地模型回答时);signup 页注册/登录走 `/v1/auth/*`(经 `local-llm.js` 的 `__bmaAuth`,session token 存 sessionStorage、随标签页关闭清除)。离线自动回退纯前端。

尚未做(按计划触发条件推进):Stripe 对接(收款)、生产部署(Fly.io/Railway)、云端托管版 LLM 顾问(本地 opt-in 版已可用,见上表;云端版仍按 P3 触发)。注册/登录已自建 v0(见上表),Clerk/Supabase 保留为正式上线时的可选替换。registry 测录流程已有第一步:数据文件 schema 校验(后端测试)+ 与 frontend `pickModel` 的同步断言(前端测试),改一侧不改另一侧会直接挂测试;持续测录新模型的流程待建。

隐私红线是代码结构而非承诺:schema 白名单 + 测试断言(见 `tests/api.test.py` 的 red-line 用例),照 [docs/18 §6](../docs/18-testing-and-quality.md)。

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
| 注册/登录 | ~~Clerk 或 Supabase Auth~~ → **已自建 v0**(`/v1/auth/*`,见上表) | signup.html 已区分 Free(免注册)/ Pro / Business(收公司名),照 [docs/05](../docs/05-business-model.md) 分层;正式上线若需社交登录/邮箱验证再评估 Clerk/Supabase |
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
