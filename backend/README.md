# backend/ — 后端结构与 API v0

> 这是一个**免费、非商业**的开源项目(给 AI 爱好者和开发者自己掌控技术栈用):没有付费分档、没有支付、没有 license key——所有能力对所有人开放。
> 技术参考(目录结构、全部端点规格、分库设计、auth 实现细节)见 [docs/20 后端结构与技术文档](../docs/20-backend-architecture-and-api.md)。

> 一句话:**营销站和产品本体可以长期无后端**——用户装好的 AI 全本地运行,断网可用、数据不出设备。后端只做三件锦上添花的事:方案顾问 API、匿名埋点回收、可选账号。API 在线时前端自动增强,离线时纯前端独立运行。

## 当前状态:API v0

草拟的端点已有**零依赖参考实现**(纯 Python 标准库,与前端同一哲学:无包管理器、随处可跑、易审计):

```bash
python3 backend/api/server.py              # 127.0.0.1:8940
python3 backend/tests/api.test.py          # 56 项测试(起真实服务打真实 HTTP)
```

| 端点 | 状态 | 说明 |
|------|------|------|
| `GET /v1/health` | ✅ v0 | 存活探测 |
| `POST /v1/advise` | ✅ v0 规则版 + LLM opt-in | 关键词分类 + **需求感知选模型**(显存装得下的里面,best_for 命中模板者加权胜出——docs/11 的 `(场景, VRAM)` 规则表),镜像 frontend 规则;设 `BMA_ADVISOR_LLM=http://127.0.0.1:8080` 可换用本地 LLM 分类(**仅接受回环地址**,超时/垃圾输出/服务不在一律回退规则,响应带 `advisor: client\|llm\|rules`);`need_text` 只在内存处理,不落日志/库/回显 |
| `GET /v1/registry/models` | ✅ v0 | 数据文件 `api/registry.json` 驱动,每个模型带 `best_for` 擅长域(与 frontend `MODELS`/`pickModel` 全字段 + 规则矩阵双重同步,测试强制) |
| `POST /v1/telemetry/deploy` | ✅ v0 | 字段白名单(枚举/整数/布尔),未知字段与自由文本一律 400,落 SQLite;**opt-in** 匿名遥测,反哺推荐准确率 |
| `POST /v1/feedback` | ✅ v0 | 同上;**没有任何 content 字段,结构上收不了内容** |
| `POST /v1/auth/signup` `login` `logout` + `GET /v1/auth/me` + **找回/验证**(`/v1/auth/forgot` `reset` `verify`)+ **账号自助**(改密/改邮箱/全登出/导出/删除,`/v1/account/*` 五端点) | ✅ v0 自建 | 真实用户表:**身份与遥测分库**(`users.db` / `events.db` 文件级隔离,匿名承诺可审计);密码 PBKDF2-HMAC-SHA256 盐哈希、session 只存 token 的 sha256,库泄露也拿不到密码/凭证;邮箱唯一(不区分大小写),登录失败恒定 401 不区分「邮箱不存在/密码错」;**密码找回/邮箱验证**走一次性链接令牌(只存 sha256、单次使用、限时),发信抽象层 `mailer.py`(dev-stdout / SMTP-SES 双后端),forgot 恒定响应防枚举 |

账号是**完全可选**的:它只用来在多设备间同步偏好、订阅更新等轻量用途;不注册也能用产品的一切核心能力。

**前端已接入**(实现见 [docs/16 §9](../docs/16-local-ai-web-integration.md)):API 在线时,向导"推荐方案"走 `/v1/advise` + registry(方案卡带实时标识,生成文件与之一致);点"生成文件"上报 `/v1/telemetry/deploy`(`stage:'plan_generated'`,与真实安装结果区分——数据种子);聊天 👍/👎 上报 `/v1/feedback`(仅 评分+模板+模型 id,仅在真实本地模型回答时);signup 页注册/登录走 `/v1/auth/*`(经 `local-llm.js` 的 `__bmaAuth`,session token 存 sessionStorage、随标签页关闭清除)。向导/遥测/反馈离线自动回退纯前端;**auth 是唯一例外**——离线时注册/登录显式报错、dashboard 无 session 出登录墙,不假装成功。

生产化地基已就位:`--host` 绑定 + 非回环默认密钥拒启(`BMA_ADMIN_SECRET`,证明部署是有意配置的)、auth/events 分桶限速(429)、Content-Length/超时加固、**SQLite 生产化**(两库走 `connect_db()` 开 WAL + `busy_timeout` + `synchronous=NORMAL`,`run_migrations()` 版本化幂等迁移)、**结构化 body-free 日志**(`BMA_LOG`,每响应一行 JSON 只记 method/path/status/ms/ip,红线不破)、**在线备份 + 恢复演练**(`ops/backup.py --selftest`,CI 每次跑),详见 [docs/20 §3/§11](../docs/20-backend-architecture-and-api.md)。**部署配置就绪**(仓库根 `deploy/`:同源反代 Caddyfile/nginx.conf + systemd 服务/备份单元 + CSP/HSTS 安全头 + 运行手册)、**CI 就绪**(`.github/workflows/tests.yml` 双套件并行)。

隐私红线是代码结构而非承诺:schema 白名单 + 测试断言(见 `tests/api.test.py` 的 red-line 用例),照 [docs/18 §6](../docs/18-testing-and-quality.md)。

## 0. 设计原则

1. **产品本体永不依赖我们的服务器。** 用户装好的 AI 全本地运行([docs/04](../docs/04-mvp.md)),断网可用、数据不出设备——这是核心价值,任何后端设计不得侵蚀它。
2. **能不建就不建。** 后端只留给纯前端做不到的东西:云端顾问推荐引擎、跨设备账号、聚合遥测。其余一律留在浏览器里。
3. **隐私边界白纸黑字。** 用户文档、聊天内容、知识库**永不上传**;上传的只有匿名化的部署遥测(机型档位/模型选择/安装成败),且 opt-in([docs/13 §埋点](../docs/13-validation-testing-and-experiments.md))。

## 1. 方案顾问 API(核心自建)

这是 [docs/11](../docs/11-ai-architecture-and-model-routing.md) 里"方案顾问用云端 API"的服务端,也是这套后端里最值得认真做的一块:

| 服务 | 作用 | 接口 |
|------|------|------|
| 方案顾问 API | 自由文本需求 + 硬件档位 → 推荐方案(规则表 + 可选本地/云端大模型);替换 frontend 的规则版推荐和本地分类器 | `POST /v1/advise { need_text, hardware } → { template, model, rag, mode, why }` |
| 模型库 Registry | 持续测试/收录开源模型的 license、显存、量化、兼容性;演示站与安装器拉取更新 | `GET /v1/registry/models?vram=12` |
| 部署遥测(opt-in) | 匿名回收 装机成败/机型档位/所选模型 → 反哺推荐准确率 | `POST /v1/telemetry/deploy` |
| 反馈回收 | 👍/👎 的聚合统计(**内容不上传**,只传结构化标注)| `POST /v1/feedback` |

**与本地体验的关系**:顾问 API 只在"网页向导/安装前"使用;装好之后的一切推理仍在用户本机。frontend 预留的 `ADVISOR :8092` 端口(见 [docs/16 §8](../docs/16-local-ai-web-integration.md))与此并行——本地有顾问模型就用本地的,没有才走云端 API,顺序永远是 本地优先。

## 2. 隐私边界(不变)

| 永不上传 | 可上传(opt-in + 匿名) |
|----------|------------------------|
| 用户文档 / 知识库内容 | 硬件档位(GPU 型号段、显存档) |
| 聊天问题与回答原文 | 模板/模型选择、安装成败与耗时 |
| 文件名、目录结构 | 👍/👎 标注(不含消息内容) |

## 3. 可选的托管技术栈

自建 API 形态很轻——单体小服务即可(当前就是纯 stdlib Python)。若要上真实服务器:Postgres(Supabase/Neon)或继续用 SQLite,部署 Fly.io / Railway / 自己的 VPS 均可;`deploy/` 里已备好反代与进程单元。埋点若接第三方(如 PostHog)会触碰前端安全边界(全站只许 `local-llm.js` 联网、无外部资源)——届时需**有意识地放宽** `frontend/tests/security.test.js` 的断言:把域名列入显式白名单,而不是删掉检查。
