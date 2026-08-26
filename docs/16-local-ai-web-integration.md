# 16 · 本地 AI 接入网页:chat.html ↔ llm-lab 实现说明

> 一句话:演示站的聊天页(`frontend/chat.html`)现在会自动探测本机 llm-lab 模型栈——探测到就把真实模型接进聊天 UI(优先走带出处的项目知识库 RAG),探测不到就自动回退为纯静态演示。整个链路没有任何数据离开这台电脑。

## 1. 架构总览

```
浏览器 http://localhost:8931/chat.html
   │
   ├── chat.js          聊天 UI(气泡/流式/引用/反馈),暴露 __chatLive 接口
   └── local-llm.js     本地模型连接器(全站唯一允许 fetch 的文件)
          │
          ├── PORTAL = http://127.0.0.1:8090   Michael AI Portal
          │      POST /api/rag  ── 检索(→8081 bge-m3)+ 生成(→8080 Qwen)
          │                        返回 {answer, sources[{file,section}], empty}
          │
          └── BASE   = http://127.0.0.1:8080   llama.cpp(Qwen2.5-7B-Instruct)
                 POST /v1/chat/completions(stream:true, SSE 流式)
```

**模式阶梯**(加载时探测,断线每 15 秒重探):

| 模式 | 条件 | 表现 |
|---|---|---|
| ① 项目 RAG | 8080 + 8090 都在线 | 标题"项目知识 AI · 本地 RAG";回答从项目文档检索,带引用卡(文件 + 章节);检索不到的问题自动降级到 ② |
| ② 通用聊天 | 仅 8080 在线 | 标题"我的本地 AI · 通用问答";流式回答,多轮上下文(最近 12 条) |
| ③ 静态演示 | 都不在线 | 原始行为:小样本知识库的预置答案,页面功能完整 |

## 2. 启动方式

```bash
ai                                # llm-lab:8080 聊天 / 8081 向量 / 8082 代码 / 8090 门户
cd ~/AI-SET-UP-GROUP/frontend
python3 -m http.server 8931       # 必须走 http://(file:// 下浏览器禁止 fetch)
open http://localhost:8931/chat.html
```

## 3. 知识库(RAG)语料与重建

- 当前索引:**本项目全部 `.md` 文档**(docs/01–16 + figma/design-system.md,`README.md` 按 rag_pro 的设计排除),330+ 片段。
- 旧的 knowledge-base 语料索引已备份在 `~/llm-lab/rag/index-pro.backup-knowledge-base-20260815.json`。
- 文档改动后增量更新:`ai ingest ~/AI-SET-UP-GROUP`;彻底重建:`ai reindex ~/AI-SET-UP-GROUP`。
- 换回旧语料:`ai reindex knowledge-base`(或把备份文件复制回 `rag/index-pro.json`)。

## 4. 连接器(frontend/assets/local-llm.js)关键实现

**探测与降级**:`DOMContentLoaded` 时 GET `BASE/v1/models`(1.5s 超时)拿模型名,再探 `PORTAL/api/health` 决定 RAG 模式;任一失败进入下一档,并安排 15 秒重探。UI(右上角模型芯片、页头标题、底部提示、建议问题)随模式切换,且都带 `data-en/data-zh` 双语属性。

**流式(SSE)解析**:按规范实现——连续 `data:` 行合并为一个事件、空行分发、兼容 CRLF、`[DONE]` 立即终止并 `reader.cancel()`、连接意外关闭时 flush `TextDecoder` 并解析残余缓冲。

**打断语义**(最容易出错的部分,经对抗性复核修过两处 high):
- 每个请求持有**独立的 AbortController**,配合全局代数计数器 `gen`;过期请求的任何异步收尾(包括 `finally`)都通过 `gen`/身份比对判定为 stale,不允许碰共享状态——避免"打断后下一条流再也停不下来"的竞态。
- 用户打断(新问题/切会话/新对话)时,**同步**把已流出的半截回答提交进历史;一个 token 都没出就把悬空的 user 轮删掉——保证发给模型的 messages 永远是干净的交替结构。
- 切换会话会把页面上可见的预置对话作为 seed 注入历史,所以在预置会话里追问,模型是有上下文的。

**引用渲染**:`/api/rag` 的 `sources[{file, section}]` 经 `chat.js` 的 `addCite()` 渲染为与演示一致的引用卡;全部走 `textContent`,模型输出没有任何 HTML 注入路径。

**安全边界(由测试强制)**:`frontend/tests/security.test.js`(90 项)规定——
- 全站只有 `frontend/assets/local-llm.js`(按**精确路径**豁免,防同名文件混入)可以发起网络请求;
- 其余文件出现 `fetch/XHR/WebSocket/EventSource/sendBeacon/new Image(/import(` 即测试失败;
- 连接器内 `BASE`/`PORTAL`/`ADVISOR` 必须各只赋值一次、指向 `127.0.0.1`,每个 `fetch` 必须以三者之一开头,不允许出现其他 URL 字面量。

## 5. llm-lab 侧的两处配套改动

1. **门户 CORS**(`apps/michael-ai-portal/server.py`):新增 `_cors()` + `do_OPTIONS()`,仅当 `Origin` 是 `http://localhost:*` / `http://127.0.0.1:*` 时回显 `Access-Control-Allow-Origin`——浏览器跨端口调用 `/api/rag` 需要;非本机来源一律不放行。
2. **嵌入服务批量上限**(`start-embed.sh`):llama-server 默认 `ubatch=512`,单条超过 512 token 的输入(中文长段落非常常见,~800 汉字即超)会直接 500,导致 `ai reindex` 中文语料失败。已加 `-c 2048 -b 2048 -ub 2048`。

## 6. 已验证清单(CDP 无头浏览器实测)

- RAG 模式识别、标题/芯片/提示/建议问题切换 ✓
- "MVP 都包含什么?" → 从 `04-mvp.md` 检索回答 + 引用卡(含章节路径)✓
- 离题问题(`1+1`)→ RAG 拒答 → 自动降级通用聊天回答 ✓
- 连续两次打断流式回答 → 无卡死、无孤儿流、历史不错序 ✓
- 中文模式点建议问题 → 中文回答 ✓;预置会话追问 → 正确利用 seed 上下文 ✓
- 服务停掉 → 回退演示答案 + "已断开"提示,15 秒自动重连 ✓(代码路径)
- 安全套件 90 项全绿 ✓

## 7. 边界与下一步

- RAG 是"检索优先、宁拒不编"(门户 `min_sim=0.30`);答不出的会退到通用模型,通用回答**不带引用**——这是有意的诚实设计。
- 演示页的"知识库"侧栏面板仍是模拟(拖文件只是动画);真正的语料管理在 llm-lab 侧(`ai ingest/reindex`)。下一步可把面板接到门户,做到网页上传 → 实时入库。
- 8082 的 Qwen2.5-Coder 尚未接入网页,可作为 build.html "生成安装脚本"的真实后端。

## 8. build.html 需求框 → 本地 AI 顾问(方案分类)

向导第一步的自由文本框已接本地 AI:输入一句需求(防抖 900ms 或按回车),本地模型把它分类到六个模板 id 之一(`company/legal/writing/research/support/data`),自动高亮对应模板卡并显示"🤖 你的本地 AI 已选中"提示;手动点卡可随时覆盖。

**端点阶梯**:`ADVISOR = 127.0.0.1:8092`(**预留端口**——在此起任意 OpenAI 兼容服务即接管分类,适合以后换专门的顾问模型)→ 回退 `BASE = 127.0.0.1:8080`(llm-lab 聊天模型)→ 都不在则纯演示(手动选卡)。请求为非流式 `/v1/chat/completions`,`temperature 0`、`max_tokens 6`,带代数计数器防止打字过程中的过期回包乱选卡。

**安全分工**(与既有边界一致):读框、发请求都在 `local-llm.js`(唯一联网文件);`build.js` 只暴露 `window.__buildAdvisor.select(slug)` 钩子,自己**从不读框值**——自由文本只会到 `127.0.0.1`,永远不会进入生成的安装包/清单/手册(两条都有测试断言)。

## 9. 前端 ↔ 后端 API(本地 127.0.0.1:8940 / 部署同源)

自建后端 v0(`python3 backend/api/server.py`,见 [backend/README.md](../backend/README.md))在线时,前端自动增强四处;向导/反馈/统计离线自动回退、页面功能不变,**auth 除外**(离线显式报错,见下):

**向导推荐方案**:进入第 3 步时,`build.js` 通过 `window.__buildAdvisor.planProvider` 钩子(由 `local-llm.js` 注册)请求 `POST /v1/advise`(只传 模板 slug + 硬件档位,**不传需求框文本**——分类已由 §8 的本地模型完成)。成功则方案卡换用 registry 数据并显示"✦ 实时推荐 · 模型库";带 `planGen` 代数守卫防止切换模式后的过期回包覆盖;**生成的安装包/手册与 API 方案一致**(renderOutput 优先用 apiPlan)。

**聊天反馈**:👍/👎 时 `chat.js` 派发 `chat-feedback` 事件(detail 只有 rating),`local-llm.js` 监听并在 满足"真实本地模型已回答 + API 在线"时 `POST /v1/feedback`,载荷仅 `{rating, template, model_id}`——纠正文本框的内容**永不上报**(后端 schema 结构上也收不了)。

**方案统计(数据飞轮种子)**:点"生成我的文件"时,`build.js` 用 slug/档位/布尔构造载荷,经 `window.__buildAdvisor.reportPlan` 钩子 `POST /v1/telemetry/deploy`,带 `stage:'plan_generated'` 与真实安装结果区分;仅当方案本身来自 API(id 与 registry 对齐)且 API 在线时上报,fire-and-forget。

**账号(注册/登录/登录态)**:`local-llm.js` 暴露 `window.__bmaAuth`(signup/login/me/logout,4 秒超时),`signup.js` 与 `dashboard.html` 经它走 `/v1/auth/*`;session token 存 sessionStorage(关标签页即清)。**这一处不做离线降级**:API 不可达时注册/登录显式报错、dashboard 出登录墙,绝不假通行(docs/22 P0-14;端点规格与威胁模型见 [docs/20 §5/§7](20-backend-architecture-and-api.md))。

**边界不变**:BASE/PORTAL/ADVISOR 钉死 `127.0.0.1`、只赋值一次;`API` 是锁形条件式(本地页 `127.0.0.1:8940`,部署页同源相对 `''`,docs/22 P0-13);每个 fetch 以四常量之一开头(安全套件 90 项)。
