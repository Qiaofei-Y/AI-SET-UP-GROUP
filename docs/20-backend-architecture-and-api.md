# 20 · 后端结构与技术文档(API v0)

> 本文是 `backend/` 的**完整技术参考**:目录结构、分库设计、全部端点规格、校验机制、auth/license 实现细节、隐私红线到测试断言的映射。
> 战略层面(为什么自建、何时上线、买还是建)见 [backend/README.md](../backend/README.md);全站安全模型见 [19 安全与隐私模型](19-security-model.md)。

---

## 1. 一句话定位

**零依赖(纯 Python 标准库)的单文件 API**,跑在 `127.0.0.1:8940`,给纯静态前端做可选增强:前端离线可独立运行,API 在线时向导推荐、遥测、反馈、账号四件事变成真的。与前端同一哲学:无包管理器、随处可跑、易审计。

## 2. 目录结构

```
backend/
├── README.md              # 演进计划(P0→P3)+ 当前状态表(战略文档)
├── api/
│   ├── server.py          # 全部后端:HTTP 路由、schema 校验、auth、license、存储(~600 行)
│   ├── registry.json      # 模型库数据文件(规则即数据,docs/09 M2-2;与前端 pickModel 同步,由测试强制)
│   └── data/              # 运行时生成,已 gitignore(backend/.gitignore: api/data/)
│       ├── events.db      # 匿名遥测:telemetry + feedback 两张表
│       └── users.db       # 身份数据:users + sessions 两张表(与 events.db 物理分库)
└── tests/
    └── api.test.py        # 39 项测试:起真实服务打真实 HTTP,含隐私红线与传输加固断言
```

**单文件后端是有意的**:`server.py` 内部按注释分节(registry → advisor → license → auth → schema 白名单 → storage → HTTP),规模到需要拆分时(约千行)再按节拆模块,不提前抽象。

## 3. 运行与环境变量

```bash
python3 backend/api/server.py              # 127.0.0.1:8940
python3 backend/api/server.py --host 0.0.0.0   # 非回环绑定:必须先注入真实 BMA_LICENSE_SECRET,否则拒绝启动
python3 backend/api/server.py --mint pro   # 铸造演示 license 后退出(pro|business)
python3 backend/api/server.py --set-plan EMAIL TIER  # 运营:改用户套餐(P0-3 唯一入口,webhook 上线前)
python3 backend/tests/api.test.py          # 测试(自起服务于随机端口,不占 8940)
```

| 环境变量 | 默认值 | 作用 |
|---|---|---|
| `BMA_LICENSE_SECRET` | `dev-secret-change-me` | license HMAC 签名密钥;**真实部署必须注入,且值绝不进仓库**。fail-closed:`--host` 为非回环且密钥仍是默认值时,启动前直接退出(P0-17) |
| `BMA_DB` | `api/data/events.db` | 匿名遥测库路径(测试用它隔离) |
| `BMA_USERS_DB` | `api/data/users.db` | 身份库路径(测试用它隔离) |
| `BMA_RATE_AUTH` | `30/60` | auth 三端点(signup/login/logout)每客户端 IP 的限速,格式 `次数/秒`(login 每次跑 10 万轮 PBKDF2,是 CPU DoS 面,P0-16) |
| `BMA_RATE_EVENTS` | `120/60` | telemetry + feedback 每客户端 IP 的限速(匿名可写盘,防刷爆磁盘/投毒数据飞轮) |
| `BMA_ADVISOR_LLM` | 空(关闭) | 顾问 LLM 分类的本地端点,如 `http://127.0.0.1:8080`;**只接受回环地址**,非回环一律忽略 |
| `BMA_DEBUG` | 空(关闭) | 打开访问日志(只记路径,永不记请求体) |

默认绑 `127.0.0.1`,`--host` 可改(生产:TLS 反代在前,见下);CORS 只放行 `localhost` / `127.0.0.1` 任意端口的 Origin(浏览器侧再由前端安全测试保证只有 `local-llm.js` 能发请求)。传输加固:请求体上限 16 KB(超出 413),负数/非数字 `Content-Length` 直接 400(不再触发吞 socket 的负数 read),连接级 10 秒超时(slowloris 面),超限速端点返回 429。

### 3.1 生产部署拓扑(同源,docs/22 P0-13)

**定案:同源部署**——一个域名同时服务静态前端与 `/v1/*` API,反代终结 TLS 并把 `/v1/*` 转给后端。前端 `local-llm.js` 的 `API` 常量是锁形条件式:页面在 `localhost`/`127.0.0.1` 时为 `http://127.0.0.1:8940`(本机开发/演示),其余任何域名下为 `''`(同源相对路径)——**前端零配置,同一份静态文件本地和生产都直接可用**。

要点:
- **后端在反代后仍只绑 `127.0.0.1`**(同机部署),不需要 `--host`;TLS、HTTP/2、连接排队全部由反代承担。`--host` + fail-closed 密钥检查只服务于「后端单独暴露」的少数场景。
- 同源请求不涉及 CORS,现有 localhost 白名单无需放宽。
- **真实密钥仍必须注入**(`BMA_LICENSE_SECRET`):同源拓扑下 fail-closed 启动检查不触发(回环绑定),密钥纪律靠部署清单保证。
- Caddy 参考(自动 HTTPS):

```
buildmyai.example.com {
    handle /v1/* {
        reverse_proxy 127.0.0.1:8940
    }
    handle {
        root * /srv/buildmyai/frontend
        file_server
    }
}
```

nginx 等价:`location /v1/ { proxy_pass http://127.0.0.1:8940; }` + 静态 `root`。CSP 响应头建议见 [frontend/tests/README.md](../frontend/tests/README.md)(同源拓扑用 `connect-src 'self'`)。

## 4. 数据存储:为什么分两个库

| | `events.db`(遥测) | `users.db`(身份) |
|---|---|---|
| 内容 | 匿名事件:装机/方案统计、👍/👎 | 账号:姓名、邮箱、密码哈希、session |
| 隐私级别 | 匿名、opt-in、可公开聚合 | 个人数据,仅本机/自建服务持有 |
| 表 | `telemetry`、`feedback` | `users`、`sessions` |

物理分库让「遥测是匿名的」这个承诺**在文件级可审计**:拿到 `events.db` 的任何人(包括未来的数据分析管道)接触不到任何身份字段;测试断言身份数据永不出现在 `events.db`(见 §10)。

表结构(建表语句在 `server.py` 的 `init_db` / `init_users_db`):

```sql
-- events.db
telemetry(id, ts, stage, template, model, os, gpu, vram_gb, ram_gb, mode,
          success, duration_s, error_code)          -- 全部枚举/整数/布尔
feedback (id, ts, rating, template, model)          -- 无任何 content 字段

-- users.db
users    (id, ts, name, email UNIQUE, company, plan, pw_salt, pw_hash, tos, plan_intent)
sessions (token_hash PRIMARY KEY, user_id, ts, expires)
```

## 5. API 参考

统一约定:请求/响应均 JSON;校验失败返回 `400 {"error": "unknown_field:x | missing_field:x | invalid_field:x | body_not_object | bad_json | bad_content_length"}`;未知路由 404;体积超限 413;限速端点(auth 三个 + telemetry + feedback)超限返回 `429 {"error": "rate_limited"}`。

### GET /v1/health
存活探测 → `200 {"ok": true, "service": "buildmyai-api", "version": "0.1"}`

### GET /v1/registry/models?vram=N
模型库(`registry.json` 驱动,每个模型带 `best_for` 擅长模板列表与 `ollama` 全量化钉版标签——短标签会被上游改指,引导安装器必须拉到方案卡承诺的那个模型)。`vram` 可选、必须为非负整数(否则 400);过滤出 `vram_min_gb ≤ N` 的模型。
→ `200 {"models": [...], "recommended": "<首个模型 id 或 null>"}`

### POST /v1/advise
需求 → 推荐方案。请求:

```json
{ "need_text": "≤500 字符,可选", "template": "枚举,可选", "mode": "枚举,可选",
  "hardware": { "gpu": "nvidia|none", "vram_gb": 0-256, "ram_gb": 0-1024 } }
```

决策链:`template` 显式给出 → 直接用(`advisor:"client"`);否则有 `need_text` 且 `BMA_ADVISOR_LLM` 配置了回环端点 → 本地 LLM 分类(`advisor:"llm"`,输出必须精确命中六个模板 slug 之一,超时/垃圾/服务不在一律回退);否则关键词规则(`advisor:"rules"`)。无独显强制云端档位。**选模型是需求感知的**(docs/11 的 `(场景, VRAM) → 方案` 规则表):在显存装得下的模型里按 `quality + 10(best_for 命中模板)` 取最高——同档内的「专长模型」胜出,大一档的通用模型要好 10 分以上才会取代;`why` 字段会说明是否按需求命中。规则与数据同 frontend `pickModel`,由 security.test.js §8 锁死同步。
→ `200 {"template", "mode", "rag", "model": {...}, "advisor", "why": {"en", "zh"}}`

**`need_text` 红线**:只在本次请求的内存里存在——不落日志、不落库、不回显;若发往 LLM 也只能是 127.0.0.1(代码先验回环再发起任何请求)。提示注入的最坏结果是选错模板(输出被枚举钳制)。

### POST /v1/license/verify
`{"license_key": "≤64 字符", "device_fingerprint": "4-64 位受限字符"}`
→ `200 {"valid": false}` 或 `200 {"valid": true, "tier": "pro|business", "grace_until": <epoch+72h>}`
key 格式 `BMA-(PRO|BUSINESS)-<12hex token>-<12hex sig>`,sig = HMAC-SHA256(secret, "TIER:token") 截断;**无状态**(不查库),验证用 `hmac.compare_digest`。72 小时离线宽限:断网用户不被锁。

### POST /v1/telemetry/deploy
字段白名单见 `TELEMETRY_SCHEMA`(stage/template/model/os/gpu/vram_gb/ram_gb/mode/success/duration_s/error_code/install_method,全部枚举/整数/布尔;`stage` 区分 `plan_generated` 与 `install`;`install_method` 枚举 `ollama_guided|cloud_manual`,让安装成功率可按交付路径分段——为 Tauri 安装器的投入决策定价)。未知字段与自由文本一律 400。→ `200 {"ok": true}`,落 `events.db`。

### POST /v1/feedback
`{"rating": "up|down", "template": "枚举", "model": "4-64 位受限字符"}`——`model` 是形状受限 id 而非枚举(聊天可能跑库外模型),**结构上没有任何 content 字段**。→ `200 {"ok": true}`。

### POST /v1/auth/signup
```json
{ "name": "≤80 字符单行", "email": "≤254 邮箱形状", "password": "8-128 字符",
  "company": "可选,同 name 规则", "plan": "free|pro|business,可选——仅记为意向(users.plan_intent)",
  "accept_tos": "必填,必须为 true(clickwrap,docs/22 P0-5)" }
```

接受记录:服务端把当前条款版本(`TOS_VERSION`,现为 `draft-2026-08-25`)连同注册时间戳写入 `users.tos`——政策改版时递增该常量即可区分「接受过哪一版」。

**plan 服务端权威(docs/22 P0-3)**:客户端自报的 `plan` 只落 `users.plan_intent`(漏斗信号),`users.plan` 一律从 `free` 开始;改套餐的唯一入口是服务端 `set_plan(email, tier)`——未来由 Stripe webhook 调用,现阶段用运营 CLI `python3 backend/api/server.py --set-plan EMAIL TIER`。改动即时生效(`/v1/auth/me` 每次查库)。
→ `200 {"ok": true, "token": "<48hex>", "user": {"name", "email", "plan"}}`
→ `409 {"error": "email_taken"}`(邮箱不区分大小写唯一,存储时统一小写)

### POST /v1/auth/login
`{"email", "password"}` → 同 signup 的 200 形状;失败**恒定** `401 {"error": "bad_credentials"}`——不区分「邮箱不存在」和「密码错」(防枚举),且未知邮箱也跑一次同参数 PBKDF2(抹平时间差)。

### POST /v1/auth/logout
Header `Authorization: Bearer <token>` → 删除该 session → `200 {"ok": true}`;无 token 401。

### GET /v1/auth/me
Header `Authorization: Bearer <token>` → `200 {"ok": true, "user": {...}}`;token 未知/过期 → `401 {"error": "not_logged_in"}`。

## 6. 校验层:schema 白名单(隐私红线的可执行形式)

所有 POST 体都过 `validate(body, SCHEMA)`:**未知键直接 400**(白名单,不是黑名单),必填缺失 400,值不过形状检查 400。检查器就五种:

| 检查器 | 规则 | 用途 |
|---|---|---|
| `_enum(*vals)` | 值 ∈ 固定集合 | 模板/模式/系统/GPU/评分/套餐… |
| `_int(lo, hi)` | 整数且在范围内(显式排除 bool) | 显存/内存/耗时 |
| `_bool` | 严格布尔 | success |
| `_short_id` | `^[A-Za-z0-9.\-]{4,64}$` | 模型 id、设备指纹——形状上藏不进自由文本 |
| `_need_text` / `_email_shape` / `_identity_name` / `_password_shape` | 长度/形状受限的例外字段 | 仅 advise 与 auth,见 §5 各端点 |

原则:**能用枚举不用形状,能用形状不用长度**;新增字段先想「这个字段能不能被滥用成内容通道」。

## 7. auth 实现细节与威胁模型

- **密码**:PBKDF2-HMAC-SHA256,每用户 16 字节随机盐,100,000 轮(`PBKDF2_ITERS`)。明文只存在于请求处理的内存中。
- **session**:`secrets.token_hex(24)`(48 hex)发给客户端;库里只存 `sha256(token)`。有效期 30 天(`SESSION_DAYS`),`me` 查询时校验 `expires`。
- **威胁推演**:`users.db` 整库泄露 → 拿不到明文密码(PBKDF2+盐)也拿不到可用凭证(token 只有哈希);拿到网络包 → 全链路 127.0.0.1 回环;枚举注册邮箱 → 登录恒定 401 + 恒定耗时,signup 的 409 是有意的取舍(注册页需要提示「该邮箱已注册」,见 frontend/assets/signup.js)。
- **前端侧**:token 存 `sessionStorage`(关标签页即清,不用 localStorage);所有请求经 `local-llm.js` 的 `__bmaAuth`(全站唯一允许联网的文件,fetch 钉死在 `API` 常量上)。

## 8. 隐私红线 → 测试断言映射

| 红线(docs/19 §4) | 可执行形式 | 测试(backend/tests/api.test.py) |
|---|---|---|
| 遥测收不了内容 | schema 白名单,未知字段 400 | `test_telemetry_rejects_unknown_and_freetext_fields` |
| 反馈收不了内容 | FEEDBACK_SCHEMA 无 content 字段 | `test_feedback_rejects_content` |
| need_text 不落盘不回显 | 内存处理 + 日志只记路径 | `test_advise_never_echoes_or_stores_need_text` |
| need_text 不出机器 | LLM 端点先验回环 | `test_advise_llm_non_loopback_url_ignored` |
| 明文密码永不落盘 | PBKDF2 后才入库 | `test_auth_secrets_never_stored_and_events_db_untouched` |
| 身份不进遥测库 | 物理分库 | 同上(断言 email 不在 events.db 字节里) |
| 断网用户不被锁 | license 72h 宽限 | `test_license_roundtrip` |

改 `server.py` 前先读这张表:**动到任何一行的实现,对应测试必须先想清楚怎么改**(放宽断言的流程见 [18 §6](18-testing-and-quality.md))。

## 9. 前端接入面(谁调什么)

| 前端功能 | 端点 | 调用方 | 说明 |
|---|---|---|---|
| 向导第 3 步方案卡 | `POST /v1/advise` | `local-llm.js` `advisePlan()` ← `build.js` 钩子 | 只传 slug+硬件,不传需求框文本 |
| 「生成文件」埋点 | `POST /v1/telemetry/deploy` | `local-llm.js` `reportPlan()` | `stage:'plan_generated'` |
| 聊天 👍/👎 | `POST /v1/feedback` | `local-llm.js` 监听 `chat-feedback` 事件 | 仅真实本地模型回答时 |
| 注册/登录 | `POST /v1/auth/*` | `local-llm.js` `__bmaAuth` ← `signup.js` | **离线显式报错,不假通行**(P0-14) |
| 登录态展示/退出 | `GET /v1/auth/me`、`logout` | `__bmaAuth` ← `dashboard.html` | sessionStorage token;无有效 session 时登录墙拦截 |

向导/遥测/反馈离线自动降级——**API 是增强,不是依赖**(设计原则 1,backend/README §0)。**唯一例外是 auth**:账号是真实状态,离线时注册/登录显式报错、dashboard 出登录墙,绝不假装成功(docs/22 P0-14,商用前提)。

## 10. 测试策略

`api.test.py` 起**真实服务**(随机端口、临时库)打**真实 HTTP**,不 mock 内部函数;LLM 顾问用 stdlib 假服务模拟 采用/垃圾回退/宕机回退 三态。39 项覆盖:五组业务端点(含需求→模型匹配矩阵与 install_method 白名单)、auth 全流程(含 clickwrap 留痕与 plan 服务端权威)、隐私红线、传输加固(CORS 白名单、413、bad JSON、404、负/非法 Content-Length 400、分桶限速 429、默认密钥拒绝非回环绑定)。跑法见 §3;提交门槛(前后端两套全绿)见 [18 测试与质量规范](18-testing-and-quality.md)。

## 11. 与演进计划的衔接

当前实现对应 backend/README 的「P2/P3 提前动工的 v0」:auth/license/telemetry/feedback/advise 都已是真实现,但**上线时机仍按触发条件**(P1 投放、P2 漏斗 ≥50、P3 付费 ≥10)。生产化地基已就位(docs/22 批次 0 的代码部分):`--host` 绑定、分桶限速、密钥 fail-closed、Content-Length/超时加固。到 P2 正式化时的剩余升级点:TLS 反代 + 进程管理(systemd)、CORS 放行生产域名(与 P0-13 同源部署一起定)、SQLite WAL/备份、Stripe webhook 调 `set_plan()` 写 `users.plan`(入口已就位)、license 与 user 关联、(如需社交登录/邮箱验证)评估 Clerk/Supabase 替换自建 auth;到 P3:顾问换云端大模型、registry 持续测录管道。
