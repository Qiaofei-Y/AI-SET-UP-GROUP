# 新成员上手指南(ONBOARDING)

> 给第一次进入本仓库的协作者:15 分钟跑起来、知道改动前读什么、别踩哪些雷。
> 深入细节一律走链接,本文只做导航与门槛清单。AI 协作者(Claude Code 等)另见 [CLAUDE.md](CLAUDE.md)。

## 0. 这是什么项目

「Build My AI」——面向**非技术用户**的个人 AI 搭建平台,目标市场**美国**(模型源/云服务/支付渠道一律用美国资源),文档语言保持中文、网站 UI 默认英文可切中文。当前阶段 = 产品文档 + 可运行演示站(`frontend/`,零构建静态站)+ 零依赖后端 API v0(`backend/`,纯 Python stdlib)。全部文档索引见 [README.md](README.md);商用化差距与路线在 [docs/22](docs/22-commercial-readiness-audit.md)。

## 1. 五分钟跑起来

```bash
# 前端(chat.html 的 fetch 在 file:// 下被禁,必须走 http://)
cd frontend && python3 -m http.server 8931
open http://localhost:8931/index.html

# 后端 API v0(可选增强;在线时向导推荐/遥测/注册登录变成真的)
python3 backend/api/server.py            # 127.0.0.1:8940

# 两套测试(提交前的硬门槛,详见 §3)
bash frontend/tests/run.sh               # 前端:102 静态/单元 + XSS 实测 + 14 页冒烟(无 Chrome 自动跳过后两项)
python3 backend/tests/api.test.py        # 后端:36 项,起真实服务打真实 HTTP
```

零依赖是刻意的:**没有 npm、没有 pip install、没有构建步骤**。只需要 Python 3 和 Node(跑测试),Chrome 可选(跑浏览器实测)。

可选:接真实本地模型需要 `~/llm-lab`(独立仓库),`ai` 一键启动后聊天页自动升级为 项目 RAG / 流式聊天;端口全表见 [docs/17 §2](docs/17-repo-architecture-and-conventions.md)。

## 2. 改动前读什么(按你要动的地方)

| 你要改 | 先读 |
|--------|------|
| 任何前端 JS/HTML | [docs/17](docs/17-repo-architecture-and-conventions.md)(三铁律、代码分割、i18n、全局钩子清单)+ [frontend/README.md](frontend/README.md)(页面与文件清单) |
| `local-llm.js`(连接器) | [docs/16](docs/16-local-ai-web-integration.md)(尤其第 4 节打断语义——全仓最易错的部分) |
| `backend/api/server.py` | [docs/20](docs/20-backend-architecture-and-api.md)(端点规格、schema 白名单、红线→断言映射) |
| 测试 / 想放宽某条安全断言 | [docs/18](docs/18-testing-and-quality.md)(§3 是唯一允许的放宽流程:白名单而非删除) |
| 网站文案 / 定价 / 流程 | docs/02、04、05、11(**文档与演示互为镜像**,改一侧必查另一侧) |
| 视觉 / 动效 | [figma/design-system.md](figma/design-system.md)(配色三色纪律、动效原则) |

## 3. 提交门槛(Definition of Done)

完整版在 [docs/18 §2](docs/18-testing-and-quality.md),速记:

1. **两套测试全绿**:`bash frontend/tests/run.sh` 必跑;动了 `backend/` 再加 `python3 backend/tests/api.test.py`。任一失败退出码 1,可直接作 pre-commit。
2. **交互改动做端到端验证**:无头 Chrome + 临时 harness 驱动真实页面(playbook 见 docs/18 §4),harness 用完即删,结论写进提交信息。
3. **文档镜像同步**:对照 [docs/17 §7 镜像表](docs/17-repo-architecture-and-conventions.md)。测试数量变了,所有提到计数的文档一起更新。
4. **新增可见文案中英成对**(`data-en`/`data-zh` 或 `t(en, zh)`),只提供一种语言视为未完成。
5. 文档改动后,llm-lab 在线时跑 `ai ingest ~/AI-SET-UP-GROUP` 刷新 RAG 索引。

## 4. 别踩的雷(测试会替你挡,但先知道为什么)

- **全站只有 `frontend/assets/local-llm.js` 允许联网**,且只能打四个受锁常量:llm-lab 三端口(8080/8090/8092)钉死 `127.0.0.1`,后端 `API` 本地页为 `127.0.0.1:8940`、部署页为同源相对路径(反代转 `/v1/*`)。在别处写 `fetch` 会直接挂测试——这是「数据不出本机」承诺的可机器验证形式([docs/19](docs/19-security-model.md))。
- **向导需求框是 write-only**:`build.js` 永不读框值;自由文本只由连接器发往本机做分类,绝不进入生成的安装包/手册。
- **用户输入/模型输出只走 `esc()` + `textContent`**,禁 `innerHTML`/`eval`/`document.write`/字符串定时器。
- **身份与遥测分库**:账号在 `users.db`、匿名事件在 `events.db`,互不沾染;遥测端点是 schema 白名单,自由文本一律 400。
- **auth 不做离线假通行**:API 不可达时注册/登录显式报错、dashboard 出登录墙(docs/22 P0-14)。别"好心"加回退。
- 改 `registry.json` 或 `build.js` 的 `pickModel` 任一侧,另一侧不同步会挂测试(前后端同步断言)。

## 5. 现在做到哪了 / 下一步

- **已完成**:演示站全站(13 页,双语 + FX 动效层,含法律三件套草案 + 注册 clickwrap)、后端六组端点 v0(advise/registry/license/telemetry/feedback/auth)、前后端打通(部署同源拓扑)、生产化地基(限速/fail-closed 密钥/`--host`)、102+36 项测试体系。
- **路线图**:[docs/22 §6](docs/22-commercial-readiness-audit.md) 按依赖排批——批次 0 剩余项(公司主体/Stripe 开户、域名/托管/反代落地、CI/备份)依赖外部动作;批次 1 = 能合法收钱;批次 2 = 付费交付物(真实安装器 + RAG 组件)。
- 工程任务拆解与验收标准:[docs/09](docs/09-mvp-engineering-tasks.md)。

## 6. 协作约定

- **架构级改动先写决策记录**(docs/17 §8 有先例格式):为什么、备选、触发重新评估的条件。
- **新增全局钩子 / 端口 / 文档**,分别登记到 docs/17 §6 钩子清单、§2 端口表、README.md 索引——三处都是"唯一登记处"。
- 提交信息写清"验证了什么"(哪套测试、几项、端到端驱动了什么流程)。
- 有疑问先搜 docs/(RAG 语料就是这些文档,llm-lab 在线时可直接问本机门户)。
