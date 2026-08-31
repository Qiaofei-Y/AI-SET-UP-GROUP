# 23 · 上线冲刺:未来一个月执行计划(2026-08-27 起)

> 本文把 [docs/22 商用化审计](22-commercial-readiness-audit.md) §6 的批次 0/1 + §4 P1 首月项,拆成 **4 周、可勾选、按依赖排序** 的执行清单。原则:**代码可自足交付且可测试的先做**(不阻塞于外部账户);**需要外部动作的(公司主体/Stripe 账户/律师/域名)第一天并行启动、代码侧先建好接口**。验收线不变:陌生人在生产域名上 **注册→付款→拿到真实交付物→在线退订**,全程合法合规。

## 图例

- 状态:`☐` 待办 · `◐` 进行中 · `☑` 完成
- 侧:`代码`(本仓库可完成并测试)· `外部`(需账户/主体/律师/域名等人工动作)· `混合`
- 每条给出 **验收信号**(怎么算做完)与关联的 P0/P1 编号

---

## 第 1 周 · 支付地基 + 站点基建(代码为主)

收钱链路的代码骨架先立起来,用 Stripe **测试密钥** 即可端到端跑通;真实密钥待外部账户到位后仅换环境变量。

| 状态 | 侧 | 条目 | 验收信号 | 关联 |
|---|---|---|---|---|
| ◐ | 外部 | **注册公司主体 + 开 Stripe 账户**(周期长,第一天启动) | Stripe Dashboard 拿到 test/live 密钥;EIN/主体名落定 | P0-4 |
| ☑ | 代码 | **Stripe Checkout 会话创建端点** `POST /v1/billing/checkout` | ✅ `_billing_checkout` 登录态传 plan→`stripe_post` 建托管结账并返回 URL;无密钥 503 `billing_unavailable`;非付费 plan 400。测试:requires_login / unprovisioned_503 / rejects_bad_plan | P0-1 |
| ☑ | 代码 | **Stripe Webhook 回写** `POST /v1/billing/webhook` | ✅ `verify_stripe_signature`(纯 stdlib HMAC-SHA256 + 300s 时间窗)校验原始字节;`checkout.session.completed`/`customer.subscription.updated|deleted`→`apply_subscription`(按 customer id);伪造签名 400、过期时间戳拒收。测试:bad_signature / stale_timestamp / drives_plan_lifecycle | P0-1/3 |
| ☑ | 代码 | **users 表加 stripe_customer_id / subscription_status / plan_period_end** | ✅ 三列经 `USERS_MIGRATIONS` 版本化幂等迁移(见 P1 SQLite);webhook 落库;`test_billing_migration_columns_exist` 断言字段存在 | P0-1/3 |
| ☑ | 代码 | **plan 门禁消费方**:后端 `require_plan()` 装饰逻辑 + 前端按 `plan` 显隐 | ✅ 服务端权威 entitlements 清单(`/v1/auth/me` + `/v1/entitlements`)+ `_require_capability()` 守卫;free 账号打 `/v1/pro/rag-manifest`→402 `upgrade_required`,set_plan→pro 即放行(后端测试断言全生命周期);dashboard 新增 LIVE「你的套餐」卡按 entitlements 显隐 + free 显升级 CTA。**诚实约束**:只有真实能力(advanced_rag 为唯一已上线 Pro 功能)进清单,coming-soon 不假门禁 | P0-3 |
| ☑ | 代码 | **站点基建**:`404.html` / `robots.txt` / `sitemap.xml` / SEO meta / OG 标签 | ✅ 13 页各有 per-page `description` + `canonical` + OG/Twitter 标签(首页含双语 `og:locale`);`404.html` 双语 + `noindex` + 沿用 `fx`/`i18n` 约定;`robots.txt` 允许收录、`Disallow: /dashboard.html`;`sitemap.xml` 用 `__DOMAIN__` 占位待部署替换;smoke 覆盖 404;全站仍无外部资源(135 安全断言 + 15 页 smoke 全绿) | P1 站点基建 |
| ☑ | 代码 | **SQLite 生产化**:WAL + busy_timeout + 迁移版本表 `schema_version` | ✅ 两库所有连接走 `connect_db()`(`journal_mode=WAL` + `busy_timeout=5000ms` + `synchronous=NORMAL`),并发读/单写不再 file-lock 串行;`run_migrations()` 用 `schema_version` 记录已跑步数,只补跑未跑步(重复启动不重跑,已验证 v5/v2 稳定),旧库(无 `schema_version`、缺列)自动补列且保留旧行;`_account_delete` VACUUM 后加 `wal_checkpoint(TRUNCATE)` 使文件级抹除仍落主库文件(字节扫描测试仍绿);后端 53 项测试全通过 | P1 SQLite |

## 第 2 周 · 结账前端 + 订阅生命周期 + 发信(混合)

| 状态 | 侧 | 条目 | 验收信号 | 关联 |
|---|---|---|---|---|
| ◐ | 代码 | **三档 CTA 接结账**:登录态升级→`/v1/billing/checkout`→整页跳转 | ✅ dashboard「你的套餐」卡:free 账号「升级到专业版」按钮 enhance 成真实结账(`__bmaBilling.checkout`→Stripe URL 整页跳转;未配密钥时 503→诚实提示「Beta 免费」,不显示坏支付流)。**待办**:营销 `pricing.html` 三档按钮仍走 Beta 免费注册,翻成付费入口留待 go-live 拍板(见 §依赖) | P0-7 |
| ☑ | 代码 | **成功/取消回跳页** `checkout-success.html` / `checkout-cancel.html` | ✅ 成功页 `checkout.js` 轮询 `/v1/auth/me`(6×2s)直到 plan 翻新,翻新即显套餐名 + 控制中心 CTA;webhook 未落地则诚实提示「稍后更新」不假解锁;取消页明示「未扣款」。均双语 + noindex + robots Disallow;egress 锁内(经 `__bmaAuth`)。smoke 覆盖两页 | P0-7 |
| ☑ | 代码 | **Billing Portal 入口**:dashboard「管理订阅」→`POST /v1/billing/portal` | ✅ 付费账号(pro/business)显「管理订阅」按钮→`__bmaBilling.portal`→Stripe 托管门户整页跳转(升/降/退订/发票全托管,契合 FTC click-to-cancel);无订阅 409→「无可管理订阅」、未配密钥 503→Beta 提示。卡数据永不进浏览器(整页跳转非 fetch) | P0-2 |
| ☑ | 代码 | **发信抽象层** `mailer.py`:接口 + dev(stdout)/SES(env)双实现 | ✅ 零依赖 stdlib:无 SMTP env 走 dev 后端(写内存 `OUTBOX` + stdout,零外发,测试据此驱动流程);设 `BMA_SMTP_HOST` 走 STARTTLS 真实投递(SES SMTP 端点即生产路径);发信尽力而为,失败不拖垮触发它的注册/找回。测试:`test_mailer_dev_backend_uses_outbox` | P0-15 |
| ☑ | 代码 | **密码找回**:`/v1/auth/forgot` + `/v1/auth/reset` | ✅ forgot 恒定 `200 {ok:true}`(防枚举),仅真实账号才发含一次性令牌的重置信;reset 兑付令牌(只存 `sha256`,单次使用,1h 时效)→ 换哈希 + **撤销全部 session** + 顺带 `email_verified=1`。测试:no_enumeration / flow_and_revokes_sessions / bad_shapes / token_never_stored_cleartext | P0-15 |
| ☑ | 代码 | **邮箱验证**:`/v1/auth/verify` + 注册后发验证信 | ✅ `users.email_verified` 版本化迁移新列,注册即置 0 并铸造 48h 一次性验证令牌发信;verify 兑付即置 1(单次使用);`me`/`login`/`signup`/`export` 响应均带 `email_verified`。测试:signup_sends_verification_and_starts_unverified / verify_rejects_bad_token | P0-15 |
| ☐ | 外部 | **FTC click-to-cancel 复核**:确认 Billing Portal 取消路径无摩擦 | 测试账户能一键取消并收确认信 | P0-2 |

## 第 3 周 · 合规上线 + 卖点对齐 + 账号自助(混合)

| 状态 | 侧 | 条目 | 验收信号 | 关联 |
|---|---|---|---|---|
| ☐ | 外部 | **法律三件套律师审阅**:主体名/联系方式/管辖州/退款窗口落定,去掉「待审阅」横幅 | 三页去草案横幅;退款窗口业务拍板写入 refunds | P0-5 |
| ◐ | 代码 | **自动续费明示披露 + 同意记录**:结账前显著展示续费条款 + 落库 | ✅ 机制完成:checkout schema 强制 `accept_terms:true`(缺/false→400),登录后 `record_billing_consent()` 落 `billing_consent`(版本)+`billing_consent_ts`(即使 503 也留痕);dashboard「升级」先弹显式续费披露(自动扣款/随时可取消 + 价格/条款/退款链接)+ 勾选框,勾选后才发起结账。导出含同意记录。列经版本化迁移(旧库 v6→v8 实测幂等)。测试:requires_consent / records_consent + 后端 64/64、前端 161/23 全绿。**待办**:披露**文案**为 draft,与法律三件套一并等律师定稿 | P0-4 |
| ☑ | 代码 | **账号设置页** `account.html`:改邮箱/改密/登出所有/导出/删除 + 全站登录态 | ✅ 登录墙守护的独立设置页(noindex + robots Disallow):Profile(姓名/邮箱/套餐 + 验证徽章)、改邮箱、改密、匿名统计开关、导出/全登出/删除——均接现有端点,`account.js` 复用 dashboard 账号逻辑。**新增改邮箱端点** `POST /v1/account/email`(密码重认证→新址立即生效但置未验证 + 向新址补发验证信;占用 409;后端 2 项测试)。**全站登录态**:`auth-nav.js` 在营销 6 页据有效 session 把「登录」换成「账号」→account.html(离线/401 fail-closed 保持「登录」;node 行为测试 4 例全过)。security 161 项 + smoke 23 页全绿 | P1 账号设置 |
| ☑ | 代码 | **遥测同意/opt-out 开关**:设置页开关 + 前端尊重 + 兑现 opt-in 承诺 | ✅ 兑现隐私页两处「opt-in」承诺(此前 telemetry/feedback 自动发送=承诺未兑现,P0-6 缺口):`local-llm.js` 新增设备级 `window.__bmaConsent`(localStorage,默认关),`reportPlan` 与 `chat-feedback` 均在 fetch 前门控 `consented()`——不勾选零外发。开关两处:build 向导生成前的勾选框、dashboard 账号卡「匿名使用统计」toggle(默认关,随时改)。并修正 pricing/index 与隐私页矛盾的「is collected」文案为「仅在你选择开启后」。测试:security 新增两条静态门控断言;真机验证默认 off + set 持久化(PASS=true) | P1 遥测同意 |
| ☐ | 代码 | **Llama 合规网站层展示**:模型页/下载处显著 "Built with Llama" + 协议链接 | 选 Llama 系模型的路径均可见协议;测试断言 | P0-10 |
| ☐ | 代码 | **卖点对齐复查**:对新增支付/账号功能再查一遍无新假象 | 无「未实现却宣称可用」文案;security 测试全绿 | P0-6 |
| ☐ | 外部 | **支持/联系渠道**:真实 support 邮箱/表单替换现「链到注册页」 | 页脚 support 指向真实收件渠道 | P1 支持渠道 |

## 第 4 周 · 部署上线 + 运维护栏(混合)

| 状态 | 侧 | 条目 | 验收信号 | 关联 |
|---|---|---|---|---|
| ☐ | 外部 | **静态站上托管**:Cloudflare Pages/Vercel + 域名 + CSP 响应头 | 生产域名可访问;CSP 头符合 docs/19 | P0-11 |
| ☐ | 外部 | **后端生产部署 + TLS 反代**:进程管理 + `/v1/*` 反代 + HTTPS | 生产域名 `/v1/health` 200 over TLS | P0-12 |
| ☐ | 代码 | **CI/CD**:GitHub Actions 跑 `frontend/tests/run.sh` + `backend/tests/api.test.py` | PR 触发全测;红则挡合并(docs/13 §9.1 模板) | P1 CI/CD |
| ☐ | 混合 | **数据库备份**:Litestream→S3 或定时 `.backup`+加密上传 | users.db 有连续/定时备份;演练一次恢复 | P1 备份 |
| ☐ | 代码 | **监控/告警/安全事件日志**:结构化日志(不记 body,红线不破)+ 5xx/429 告警 | 关键事件可查;body 仍不落盘 | P1 监控 |
| ☐ | 代码 | **代码签名申请启动**(证书周期长,与本月并行)+ 下载中心页占位 | EV/OV 证书申请已提交;`downloads.html` 骨架 | P1 签名/下载中心 |

---

## 依赖与并行提示

- **外部动作第一天并行启动**:公司主体 + Stripe 账户(第 1 周)、律师审阅(第 3 周前置)、域名/托管/证书(第 4 周,但申请越早越好)。这些不阻塞代码侧——代码用测试密钥/stdout mailer/占位主体先跑通,外部到位后只换环境变量与文案。
- **批次 2(Windows 真安装器 P0-8 / 本地 RAG P0-9 / Lambda 一键云)本月不排**:量级 L、且与收钱链路正交,待批次 0+1 验收后单独排期(docs/21 是 Lambda 方案)。
- **安全红线不动**:新增支付/发信端点全部走 schema 白名单校验、限速分桶、恒定响应;前端新页仍受 `frontend/tests/security.test.js` 约束(唯一联网豁免仍是 `local-llm.js`,支付跳转走整页 `location` 跳转而非 fetch,避免触碰联网断言)。

## 验收(月末)

批次 0+1 完成即达成:一个陌生人能在生产域名 **注册→(邮箱验证)→付款(Stripe 托管)→plan 服务端解锁→在线退订(Billing Portal)**,法律三件套经律师审阅、自动续费合规披露、发信与密码找回可用、站点有 CI/备份/监控护栏。批次 2 的真实交付物本体(安装器/RAG)转入下一个月。
