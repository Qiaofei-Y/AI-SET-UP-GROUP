# installer/ — 批次 2 付费安装器契约(代码地基)

> 这是 [docs/24 批次 2 执行计划](../docs/24-batch-2-execution-plan.md) 的**决策无关代码地基**:在真正的 Tauri 安装器落地前,先把「向导产出 ↔ 安装器读取」的契约与运行时决策固化成**单一真相源 + 可测断言**,让后续开发不会漂移、也不会重复踩坑。
>
> **诚实边界(硬约束)**:本目录的内容**尚未上线**,不面向用户。今天付费用户拿到的仍是向导生成的 **Ollama 引导安装包**(真实可用,见 `frontend/assets/build.js` 与 `downloads.html` 的「即将推出」诚实标注)。此处描述的 llama.cpp 自包含安装器是批次 2 的**目标**,签名安装器就绪前 `downloads.html` 不放真实下载按钮。

## 文件

| 文件 | 作用 | 由谁校验 |
|---|---|---|
| `runtime.json` | **运行时决策落成数据**:内嵌运行时 = **llama.cpp**(digest 钉死、单体自包含),来源限官方(github/ghcr `ggml-org/llama.cpp`)。真实 digest 于首个签名构建时测得并冻结此处——**在此之前留空**,绝不伪造。 | `frontend/tests/security.test.js §8c` |
| `manifest.schema.json` | **安装配置协议**:向导 `installManifest()` 产出的 `install-plan.json` 形状(模型/量化/文件/来源/运行时/RAG 开关/目标硬件),也是安装器将读取的同一份文档。零依赖 JSON-Schema 子集。 | `frontend/tests/security.test.js §8c`(sandbox 实跑 `installManifest` 校验符合) |
| `fetch-policy.json` | **模型工件拉取策略**:llama.cpp 安装器直接从 Hugging Face 拉 GGUF(有别于今天的 `ollama pull`)——限主机 `huggingface.co`、`resolve/main/<file>` 形状、强制 sha256、幂等可续传。逐模型真实 sha256 于构建测得,不伪造。 | `frontend/tests/security.test.js §8d`(从每个向导 manifest 推导下载 URL 校验白名单+形状) |

## 契约如何被锁住

安装器与向导必须对同一份 manifest 达成一致。测试 §8c 在 sandbox 里真跑 `build.js` 的 `installManifest()`(覆盖每个模型 × local/cloud 两种 mode),把输出逐字段比对 `manifest.schema.json`;任一侧改动导致漂移即测试失败——与既有的 `registry.json ↔ pickModel` 同步断言、生成物白名单断言同一套护栏思路。

## 运行时决策(2026-09-01 拍板)

- **选型**:llama.cpp(digest 钉死,单体自包含),不打包 Ollama。理由:自包含单二进制、MIT 许可最干净、与 [docs/21](../docs/21-lambda-cloud-integration.md) 云路径同一运行时(本地/云共用)。
- **钉版**:以镜像 digest 钉死(`ghcr.io/ggml-org/llama.cpp:server-cuda`,CPU 回退 `:server`),安装器运行前校验 digest 不符即拒绝——防供应链替换。
- **待外部动作**:首个签名构建时测得真实 digest 写回 `runtime.json`;EV 代码签名证书(长周期,day-0 已在 docs/24 排启动)。

## 红线沿用

- 安装器 WebView 仍只连 `127.0.0.1`;模型/运行时拉取一律走白名单来源 + 校验(GGUF 走 `huggingface.co/<repo>/resolve/main` + sha256,运行时走钉版 digest)。
- 新增联网面若要放宽前端 egress 锁,须按 [docs/18 §3](../docs/18-testing-and-quality.md) 流程显式改测试并说明理由。
