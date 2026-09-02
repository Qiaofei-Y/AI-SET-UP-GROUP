# 21 · Lambda 云一键部署集成设计

> 目标:cloud 模式从「生成部署手册」升级为**一键在 Lambda(lambda.ai,美国 GPU 云)开出用户自有的私有 AI 实例**——填一次 API key,点一个按钮,几分钟后能聊天。主打简单快捷,与本地优先哲学并存:云永远是用户显式选择的增强,不是依赖。
> 本文 = 在线调研(官方文档,来源见 §2)→ 集成设计 → 三视角对抗评审(API 事实/安全/小白走查,24 条修正)后的**定稿设计**。实施前必须先完成 §10 的实测清单。

## 0. 一句话结论

技术上完全可行且顺:Lambda launch API 支持 cloud-init `user_data`(≤1MB,开机自动装好推理服务),SSH key 可由 API 代生成(用户零操作),防火墙可 API 精确放行,按分钟计费无流量费。始终采用 **BYO-key**(用户自己的 Lambda 账号、账单直接付给 Lambda,应用只代调 API):项目免费开源、不经手账单、不加价、不抽成。用户看到的价格就是 Lambda 的真实价格。

## 1. 体验目标与用户流程(修正后)

三个动作,已有 Lambda 账号者 5–10 分钟可聊(8B/14B);**首次用户须提前披露门槛**:需要 Lambda 账号 + 美国信用卡,首次注册约 10 分钟(评审:别让用户走到最后一步才发现)。

1. **拿 key**:向导 step3 cloud 分支变为部署面板,引导分两支——已有账号直接粘 key / 没有账号给带截图的注册子清单。`lambda.ai` 用**可点击链接**(把 `ALLOWED_EXTERNAL_HREFS=['https://lambda.ai','https://cloud.lambda.ai']` 白名单按 docs/18 §3 流程加进 security.test.js §2——可点的正确链接比让小白手打网址更安全)。key 输入框 `type=password`,提交前 trim;「Save & check」→ 后端调 Lambda `GET /instance-types` 验真,面板显示打码 key。登录检查提到面板渲染之初(本地账户建议静默创建,把 signup 移出关键路径)。
2. **一键部署**:明码标价(实时价:如 A6000 48GB $1.09/时 ≈ 忘关一天 $26)+ 自动关机下拉(**默认 2 小时**,可 +2h 顺延)。点 Deploy 后全自动进度:Launching → Booting(2–5 分钟)→ Installing → Downloading model → Loading → **Ready**。
3. **开始聊天**:结果卡首屏只留四件事——「Open my AI」(`window.open(url,'_blank','noopener')`)、自动关机倒计时、费用计时器、「Turn off now」;端点 URL/token 折叠进 Advanced。llama.cpp WebUI 首次需在 ⚙ 里粘 token(给三步图示;更优:cloud-init 里写一个我们自己的极简落地页);「浏览器提示 Not Secure 属正常,这是你自己的服务器」要明示。

**降级**:8940 不在线或不想填 key → 永远保留「Download manual guide (.md)」(现有 cloudManual()),按钮永不成死路。**断线重入**:build.html 加载时查 `GET /v1/cloud/deployments`,有活跃部署直达面板,不重走向导。

## 2. Lambda API 关键事实(全部来自官方,2026-08 核验)

| 事实 | 要点 | 来源 |
|---|---|---|
| 认证 | `Authorization: Bearer <api_key>`;key 在 cloud.lambda.ai/api-keys 生成 | openapi.json |
| launch | `POST /api/v1/instance-operations/launch`:必填 region/instance_type/ssh_key_names(恰 1 个);可选 `user_data`(cloud-init ≤1MB)、image、firewall_rulesets(**须与实例同 region、只能 launch 时挂**)、name、tags | openapi.json |
| SSH key 代生成 | `POST /ssh-keys` 不带 public_key → 服务端生成并一次性返回私钥 | openapi.json |
| 实例状态 | `GET /instances/{id}`:status ∈ booting/active/**unhealthy**/terminating/terminated/**preempted**;含公网 ip | openapi.json |
| 计费 | 按分钟,自实例过健康检查起、至 terminate 止;**无「停机不计费」**(OS shutdown 进 Alert 照扣钱);无流量费 | docs.lambda.ai/billing |
| 限流 | 全 API 1 req/s;launch **1 req/12s** → 后端必须队列化 | openapi.json |
| 价格(1x 档) | RTX 6000 24GB $0.69/时、**A6000 48GB $1.09**(32B Q4 首选)、A10 24GB $1.29、A100 40GB $1.99 | lambda.ai/instances |
| 防火墙 | 默认只开 22/ICMP;规则支持源 CIDR;per-instance ruleset 内容 launch 后可改且即时生效 | docs.lambda.ai/firewalls |
| 生态 | ToS 不可转授权(BYO-key 合规,代管需 Partner 计划);Lambda 自家按 token 推理 API 正在关停、官方引导回 GPU 实例 | lambda.ai/legal, /inference |

**调研未确认、实施前必须实测**(§10):instance-type/region 的 API slug、`GET /instances` 是否回读 tags、ggml-org llama.cpp 是否有 Linux CUDA 预编译包、Qwen 32B GGUF 是否分片、新账号配额、us-south-1 防火墙。

## 3. 架构

**总原则:浏览器永远只连 127.0.0.1:8940;本机后端是全系统唯一的 Lambda 出口。**

```
browser(local-llm.js 新增 __bmaCloud,fetch(API + '/v1/cloud/…') 字面形式)
  → 127.0.0.1:8940(/v1/cloud/* 路由,Bearer session,schema 白名单)
    → https://cloud.lambda.ai/api/v1/*(urllib,唯一非回环出站)
    → http(s)://<活跃实例 IP>:8000(就绪探测/二期聊天代理)
```

前端直连 Lambda 不可行(推翻 security.test.js 三层断言 + key 暴露浏览器 + Lambda 无浏览器 CORS)。代价「云部署依赖本机 app 在跑」与产品形态一致,离线自动回退手册。

- 新模块 `backend/api/cloud.py`:Lambda 客户端 + **出站守卫**(仅 cloud.lambda.ai、回环(测试注入假 Lambda,`BMA_LAMBDA_API` 非回环即忽略)、活跃部署 IP——**IP 加白前须校验公网单播 IPv4**,拒 127/8、RFC1918、169.254.0.0/16(防 SSRF 打内网/元数据);HTTPS 默认证书校验,禁 `_create_unverified_context`,验证失败闭合降级手册)+ launch 限流队列(≥12s)+ key 保险箱 + 部署状态机。
- `build.js` 只画 UI、只传枚举;**永不读 `#lambdaKey` 的值**(镜像 needText write-only 红线,key 框只由 local-llm.js 读、读后立即清空)。
- 机型映射规则即数据:registry.json 每档模型加 `lambda: {instance_type, alt_types[], regions[], sha256, port}`(**模型 GGUF 必须钉 sha256**,bootstrap 校验失败即 error——GGUF 解析历史上出过 RCE 级洞)。
- 8940 加 **Host 头校验**(非 127.0.0.1/localhost 一律拒,防 DNS rebinding——现在这台服务能花真钱了)。

## 4. Lambda API key 安全(比密码更高危:能花真钱)

- **存哪(评审修正后)**:默认「仅本次会话」(后端内存);勾选 Remember 则加密落 users.db `cloud_keys` 表。**但只要存在活跃部署,key 强制加密落盘**(否则重启后自动关机/对账全瘫痪),terminate 后按用户档位回退/抹除;「有活跃部署但 key 缺失」是显式状态,前端横幅引导重粘。
- **加密(stdlib 无 AES,诚实定位)**:随机主密钥存 `~/.bma/secret.key`(**移出 data/,不与密文同目录**,chmod 0600);HMAC-SHA256 计数器流密码 + encrypt-then-MAC;enc/mac 子密钥分离派生;nonce 每次新鲜(≥16B,断言同一明文两次加密密文不同);MAC 覆盖 nonce+密文+user_id。防「users.db 被拷走」,防不了整机 root——威胁模型如实写进 docs/19。
- **红线(全部配测试)**:不进日志/events.db/浏览器任何 storage/生成文件/`user_data`(cloud-init 里只有我们生成的端点 token,绝无 Lambda key);无任何回显完整 key 的端点(只有 masked);形状 `^[A-Za-z0-9_.\-]{20,128}$`(先 trim);验真失败只映射固定枚举 `bad_lambda_key`/`lambda_unreachable`,不透传 Lambda 错误体。

## 5. 实例引导(bootstrap)

- 镜像:Lambda Stack family(x86_64;一期排除 arm64 GH200)。
- `firewall_rulesets`:**按 region 惰性创建/复用 `bma-endpoint-<region>`**(评审:ruleset 绑 region,换 region 重试时原 ruleset 不可挂);**一期即收紧 CIDR**:实例记录首个健康探测来源 IP(= 用户公网 IP,因为探测方是用户本机后端),后端据此调防火墙 API 把 8000 收到 /32——不做「0.0.0.0/0 + token 裸奔到二期」。
- cloud-init 模板 `backend/api/lambda-cloudinit.tmpl`(数据文件):write_files(bootstrap.sh、systemd 单元、0600 的端点 token)+ runcmd。llama.cpp 获取路径**以 digest 钉死的 `ghcr.io/ggml-org/llama.cpp:server-cuda` docker 为主路径**(Lambda Stack 预装容器工具链;评审:Linux CUDA 预编译 zip 的存在性未验证,实测后若存在可换为更快的主路径)。模型从 HF `resolve/main` 拉取 + **sha256sum -c**;32B 若为分片 GGUF 则循环下载(llama-server 传首片自动加载)。llama-server:`--host 0.0.0.0 --port 8000 --api-key-file /opt/bma/token -ngl 999`,systemd Restart=always。
- 状态机(后端轮询,前端只问 8940):launching → booting → installing → loading → ready;**unhealthy/preempted → error(大字「⚠ 服务器仍在计费」),terminated/terminating/查无此实例 → terminated 并停表**;`bootstrap_timeout` 默认自动 terminate 止损。error_code 枚举:`no_capacity / launch_failed / bootstrap_timeout / quota_or_billing / instance_unhealthy / terminated_externally`(quota_or_billing 文案直接给动作:「通常是还没绑卡或新账号额度——去 lambda.ai 绑卡后重试」)。

## 6. 后端端点(v1,全部 Bearer session + schema 白名单 + **属主校验:一切按 id 的操作 WHERE user_id=属主,否则 404**)

```
POST /v1/cloud/key            {api_key, remember?}        → {ok, key_masked, remembered} | 401 bad_lambda_key
GET  /v1/cloud/key                                        → {present, key_masked, remembered}
POST /v1/cloud/key/forget                                 → {ok}(有活跃部署时警告:抹除后无法自动关机)
GET  /v1/cloud/options?model=<enum>                       → {options:[{instance_type, price_cents_per_hour, vram_gb, regions_available[]}]}
POST /v1/cloud/deploy         {model, instance_type?, region?, auto_off_hours?:enum(0,1,2,4,8,24)} → 202 {deployment_id, status, price_cents_per_hour}
GET  /v1/cloud/status?id=…                                → {status, phase, ip, endpoint_url, est_cost_cents, auto_off_at, warning?, error_code?}
GET  /v1/cloud/deployments                                → 列表(build.html 重入用)
GET  /v1/cloud/token?id=…                                 → {endpoint_token}(端点 token 可回显给属主;Lambda key 永不)
POST /v1/cloud/terminate      {deployment_id}             → {ok, final_cost_cents_est}(幂等)
```

users.db 新表 `cloud_keys`、`cloud_deployments`(含 endpoint_token_enc、ssh_priv_enc——**SSH 私钥与 token 同入「不回显/不进日志/不进 events.db」字节扫描断言**);events.db 只收匿名漏斗(TELEMETRY stage 加 `cloud_deploy`)。

**守护线程**:auto-off 到点 terminate + 启动对账。对账**双信号**:name 前缀 `bma-` **且** instance_id 在本地表(或 tag 命中 `bma_install=<本安装 uuid>`);只自动终止本安装创建且超期的实例,发现非本安装的 bma 实例只提示、**绝不自动 terminate**(评审:防止两台电脑互杀、误杀用户手工实例)。

## 7. 费用透明(小白四道防线)

① 部署前明码标价 + 「从健康检查起计费,装模型的几分钟也在计费」;② **默认 2 小时自动关机**,倒计时常驻 + 一键 +2h;到点前查 llama-server `/slots` 非空闲则顺延 15 分钟(防对话中猝死);③ 运行中常驻计费器(started_ts × 实时价,全部标 ≈)+ 一键 Turn off(人话解释:关机=删除云电脑=停止计费,设置保留本机);④ 防忘关兜底:部署成功时前端写 localStorage 布尔标记 `bma-cloud-active`(无敏感内容),页面加载若标记在而 8940 离线 → 红色警告「可能有云服务器在运行,请启动应用或去 lambda.ai 手动关闭」;**第一期必须交付后端开机自启**(launchd/系统服务),否则 auto-off 对目标用户是纸面保障;terminate 返回本次总费用,建立心智。承诺用条件式表述(「由你电脑上的应用执行」),不过度承诺。

## 8. 安全测试与文档变更(docs/18 §6 流程)

**唯一实质放宽**:后端出站从「仅回环」→「cloud.lambda.ai + 活跃实例 IP(公网单播校验后)」,配 `test_cloud_non_loopback_override_ignored` 等新断言。**前端 §1 零放宽**(单一联网文件、四常量、pinnedFetches 全保留);§2 加 `ALLOWED_EXTERNAL_HREFS` 显式白名单(仅 lambda.ai 两域)。

**新增收紧**:build.js 永不读 `#lambdaKey`(双正则);storage 键名不得含 key/lambda/token(白名单 `bma-lang`/`bma-session`/`bma-user`/`bma-cloud-active`);window.open 全站只许 build.js 结果卡一处、字面含 `noopener`;cloud.py 禁用不验证的 TLS context(静态扫描)。

**后端新测试**(fake Lambda,stdlib,绝不真打):schema/越权(双用户互访 404)/key 红线字节扫描/限流间隔/状态机三态+异常态/auto-off/对账双信号/加密 nonce 新鲜性/user_data 含端点 token 不含 Lambda key。

**文档同步(同一提交)**:docs/19 §4 红线改写为精确范围——「聊天内容永不上传到 Build My AI 的服务器/遥测;**云模式下内容仅发往用户自有、显式开启并明示确认的实例**」,并给二期聊天代理立「内容全盲」红线(不落日志/库/遥测,与 need_text 同级);docs/11 云端路径改写;docs/20 端点参考补 /v1/cloud/*;CLAUDE.md 测试计数同步。UI 明示:一期聊天流量经公网(CIDR 已收紧到你的 IP,但为明文 HTTP)——TLS 是二期聊天代理上线的**硬性前置**。

## 9. 分期

**第一期 · 最小可发布**(验收标准:真实用户用自己的 key,10 分钟内聊上 8B):3 档模型 × 1 主力机型(8B/14B→RTX 6000 $0.69,32B→A6000 $1.09)、2–3 个 us-* region、docker 主路径 bootstrap、CIDR /32 收紧、8 个 /v1/cloud/* 端点、key 双档保险箱、限流队列、auto-off+对账+开机自启、fake Lambda 全套测试、部署面板 + __bmaCloud、手册回退保留。
**第二期**:后端流式聊天代理(token 后端注入,浏览器零持有,chat.html/Control Center 直聊)+ TLS + 空闲自动关机(代理侧 last_request_ts)+ 进度百分比 + 容量降级链 + hybrid 接入 + RAG 上云(独立同意流程)。

## 10. 实施前实测清单(拿一个真实 Lambda 账号,半天)

1. 抓 `GET /instance-types`、`GET /regions` 快照 → 钉 registry lambda 字段与 US_REGIONS 枚举(fake Lambda 的 catalog 直接用快照,断言 registry slug ∈ 快照);
2. 确认 `GET /instances` 是否回读 tags(决定对账实现);
3. 确认 ggml-org 是否有 Linux CUDA 预编译包(决定 bootstrap 主路径);
4. 确认 Qwen 32B GGUF 单文件还是分片(决定下载循环/换 bartowski 仓库);
5. 实测一次全链路开机耗时(booting/装载各相位),校准进度文案;顺带验证 us-south-1 防火墙、新账号配额表现、营销页所称 stop 能力是否存在(文档口径:无)。

## 11. 残余风险(UI 必须大白话披露)

忘关机是最大产品风险(Lambda 无停机不计费 + key 不上云 ⇒ 自动关机依赖本机应用);廉价机型容量经常紧张(备选链 + 实时过滤);key 本机加密防拷库不防 root;一期明文 HTTP(CIDR 已收紧,TLS 二期硬性);就绪时间无 SLA(文案 typically 5–10 minutes);HF 仓库转门禁会卡 bootstrap(sha256 + 20 分钟超时止损)。
