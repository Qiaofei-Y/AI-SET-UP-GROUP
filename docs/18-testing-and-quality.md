# 18 · 测试与质量规范

> 一句话:安全套件(静态断言 + 单元 + 真浏览器 XSS)是**每次提交前的硬门槛**;涉及交互的产品改动还要用"无头浏览器驱动真实页面"的方式做端到端验证,验证脚本用完即删,结论写进提交信息。

## 1. 测试全景

| 层 | 是什么 | 在哪 | 运行 |
|----|--------|------|------|
| 静态断言 | 扫描全部 HTML/JS,把安全模型写成可执行规则(见 [19](19-security-model.md)) | `frontend/tests/security.test.js` | `node frontend/tests/security.test.js` |
| 单元测试 | 对 chat.js 里真实的 `esc()` 投喂 XSS 载荷 | 同上(同一文件内) | 同上 |
| 浏览器实测 | 无头 Chrome 加载真实 chat.js,验证恶意输入被当纯文本 | `frontend/tests/xss.browser.html` | `bash frontend/tests/run.sh`(无 Chrome 自动跳过) |
| UI 冒烟 | 无头 Chrome 逐页加载全部页面:动效层锚点 `data-fx="on"`、顶栏存在、console 零错误 | `frontend/tests/ui.smoke.sh` | `run.sh` 自动串起(无 Chrome 自动跳过) |
| 端到端驱动 | 临时 harness 页驱动真实页面流程(见 §4) | 用完即删,不入库 | 手动/AI 执行 |
| 后端 API 测试 | 起真实服务打真实 HTTP,含隐私红线与传输加固用例(自由文本/未知字段 400、限速 429、默认密钥拒非回环绑定) | `backend/tests/api.test.py` | `python3 backend/tests/api.test.py` |

一切从 `bash frontend/tests/run.sh` 开始:任一失败退出码 1,可直接作 pre-commit / CI 门槛。零依赖,只需 Node(+ 可选 Chrome)。

## 2. 提交门槛(Definition of Done)

一次改动可以提交,当且仅当:

1. `bash frontend/tests/run.sh` 全绿;改到 `backend/` 时 `python3 backend/tests/api.test.py` 也全绿(前后端两套都是硬门槛);
2. 若改动有交互面(向导流程、聊天、连接器、模式切换):做过 §4 的端到端驱动验证,并把"验证了什么、几项通过"写进提交信息;
3. 按 [17 §7 镜像表](17-repo-architecture-and-conventions.md) 检查过文档同步(包括各文档中的**断言计数**——测试数量变了就全部更新);
4. 新增可见文案中英文成对。

## 3. 修改安全断言的流程(唯一允许的放宽方式)

安全断言**默认不许放宽**。确需放宽(如 P1 接 PostHog 时开外部域名)必须同时做到:

1. **白名单而非删除**:把新目标加进显式白名单常量,保持"其余一律失败"的结构;
2. 断言强度不降级:例如"每个 fetch 以固定常量开头"这类可机器证明的形式必须保留——宁可改代码适配测试(先例:连接器把动态端点选择写成两处字面量 fetch),不改测试迁就代码;
3. 同步更新 [19 安全模型](19-security-model.md) 的不变量表 + 提交信息说明理由;
4. 收紧、新增断言随时欢迎,不需要流程。

## 4. 端到端验证 playbook(无头浏览器驱动)

对交互改动,单靠静态测试不够,用这套已验证过多轮的方法:

**harness 模式**:在 `frontend/` 下临时建 `__verify-*.html`,用**同源 iframe** 加载目标页面,以真实事件驱动流程,轮询断言,结果打进 `<pre id="out">` 并以 `VERIFY-ALL-PASS` / `VERIFY-FAILED` 收尾:

```bash
cd frontend && python3 -m http.server 8931   # 必须走 http://(file:// 禁 fetch)
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless --disable-gpu --no-sandbox --virtual-time-budget=15000 \
  --dump-dom "http://localhost:8931/__verify-xxx.html" | grep -A20 '<pre id="out">'
```

要点:

- 驱动用真实 DOM 事件(`el.click()`、`dispatchEvent(new w.Event('input', {bubbles:true}))`),不直接调内部函数;
- 异步流程(防抖、fetch)用 `setInterval` 轮询 + 次数上限,不赌固定延时;
- **依赖外部服务的路径用本机 mock 验证**:如在预留端口 8092 起一个固定应答的小 HTTP 服务(记得 CORS:`Access-Control-Allow-Origin` + OPTIONS 预检),既验证了链路又不依赖 llm-lab 在线;
- harness 和 mock **用完即删**(mock 脚本放 scratchpad,不入库);删干净后再跑安全套件(harness 本身会触发"零外部请求"扫描)。

## 5. 测试代码自身的约定

- `security.test.js` 按编号分节(1 网络边界 / 2 HTML 资源面 / 3 危险 API / … / 7 存储),新断言加进对应节;
- 断言写成**可机器证明的形式**(正则/计数/全量扫描),不写"抽查几个文件"式的样本断言;
- 断言信息里带上实际数字(如 `(6/6)`),失败时能直接看出差在哪;
- 计数变化(如 82→83)按 §2 第 3 条同步所有提到数字的文档。

## 6. 后端测试原则(API v0 已落地)

backend API v0(见 [backend/README.md](../backend/README.md))沿用同一哲学,已实现:

- **隐私红线写成测试**:`/v1/telemetry`、`/v1/feedback` 的请求体做 schema 白名单校验,未知字段、自由文本形态的值一律 400,均有测试用例;`/v1/advise` 的 `need_text` 有"不回显、不落库、不进日志"断言(直接扫 SQLite 文件字节验证);
- **传输与滥用面也写成断言**:负/非法 Content-Length 400、auth/events 分桶限速 429(窗口由 `BMA_RATE_*` 注入,测试用小窗口验证后清计数)、非回环绑定 + 默认密钥必须拒绝启动;
- 测试起**真实服务**打真实 HTTP(临时端口 + 隔离数据库),不 mock 内部函数;
- 前端接入本 API 或任何外部 SaaS 前,先走 §3 白名单流程。
