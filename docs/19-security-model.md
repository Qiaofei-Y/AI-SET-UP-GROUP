# 19 · 安全与隐私模型

> 一句话:攻击面被刻意压到极小(纯静态、零依赖、零外发),剩下的风险(XSS、数据外发、注入到生成文件)全部写成机器可验证的不变量,由 `frontend/tests/security.test.js`(83 项)强制。

## 1. 威胁模型

| 威胁 | 评估 | 对策 |
|------|------|------|
| XSS(唯一用户输入:聊天框、需求框) | **主要风险** | `esc()` 转义 + 一律 `textContent` 渲染;禁一切危险 API(§2-C);真浏览器投毒实测 |
| 数据外发(违背"数据不出本机"承诺) | 核心声誉风险 | 单一联网文件 + 127.0.0.1 钉死(§2-A);零外部资源(§2-B) |
| 注入到生成文件(.bat 是可执行的!) | 高危路径 | 需求框对生成链路 write-only(§3);安装包内容全部来自受控静态数据 |
| 供应链 | 结构性消除 | 零 npm 依赖、零 CDN、零第三方脚本——没有供应链 |
| 密钥泄漏 | 低(无后端) | 静态扫描硬编码密钥;界面上的 `sk-local-••••` 是打码占位 |
| 恶意模型输出(本地模型被投毒语料诱导) | 低但存在 | 模型输出与用户输入同等对待:只走 `textContent`,无 HTML 注入路径 |

不在模型内:llm-lab 自身安全(用户本机服务,信任边界之内)。后端 API v0 已存在但**前端尚未接入**;其自身的红线(schema 白名单、need_text 不落盘、CORS 仅本机来源、请求体上限)由 `backend/tests/api.test.py` 强制,见 [18 §6](18-testing-and-quality.md)。

## 2. 不变量 → 断言映射

每条不变量都有对应的测试断言;改代码触碰任何一条,测试先红。

**A. 网络边界**
| 不变量 | 断言 |
|--------|------|
| 全站唯一可联网文件是 `assets/local-llm.js` | 其余全部 JS 扫描 `fetch/XHR/WebSocket/EventSource/sendBeacon/new Image(/import(`,命中即失败 |
| 豁免按**精确路径**,防同名文件混入 | 全仓只允许存在一个 `local-llm.js` 且路径必须是 `assets/` 下 |
| 只许连 `127.0.0.1` | `BASE`(8080)/`PORTAL`(8090)/`ADVISOR`(8092)各只赋值一次、必须是 `http://127.0.0.1:端口` 字面量;每个 `fetch(` 必须以三者之一开头;文件内不得出现其他 URL 字面量 |

**B. 资源面**
| 不变量 | 断言 |
|--------|------|
| 零外部资源 | 所有 `<script>`/`<link>`/图片为本地相对路径 |
| 无注入型链接 | 无 `javascript:` URL;`target=_blank` 必须带 `rel=noopener` |

**C. 输入与渲染**
| 不变量 | 断言 |
|--------|------|
| 用户输入/模型输出永不进原始 `innerHTML` | `esc()` 存在且五组攻击载荷全被转义(`<` `>` `"` `'` `&`);消息渲染走 `textContent` |
| 禁危险 API | 无 `eval`/`new Function`/`document.write`/字符串定时器/`outerHTML`/`insertAdjacentHTML`;连接器内额外禁 `innerHTML` |

**D. 生成链路**(详见 §3)
| 不变量 | 断言 |
|--------|------|
| build.js 永不读需求框值 | 正则断言无 `getElementById('needText').value` 读取、无 `box.value` 读用法 |

**E. 存储**
| 不变量 | 断言 |
|--------|------|
| localStorage 只存语言码 | `setItem('bma-lang', lang)` 形式匹配 |

## 3. 需求框数据流(最精巧的一条边界)

自由文本是攻击者可控输入,而向导会生成**可执行的 .bat**。设计把两者彻底隔离:

```
用户输入 #needText
   │
   ├── build.js:只写不读(预填/清空),文本永远不进 STATE、
   │            不进安装包/清单/手册 ——(断言 D)
   │
   └── local-llm.js:读框 → 防抖 → 只发往 127.0.0.1(ADVISOR→BASE)
                     → 模型只回一个模板 id → 白名单正则匹配
                     → __buildAdvisor.select(slug) 只传 slug,不传原文
```

即使本地模型被诱导返回恶意内容,进入页面的也只有六个白名单 slug 之一;即使连接器被绕过,生成文件的内容也全部来自受控静态数据。

## 4. 隐私红线(与后端阶段共用)

永不上传(任何阶段、任何理由):用户文档与知识库内容、聊天问题与回答原文、文件名与目录结构。可上传(opt-in + 匿名):硬件档位、模板/模型选择、安装成败、👍/👎 标注(不含内容)。完整表见 [backend/README.md §5](../backend/README.md)。

**默认状态更强**:当前前端连遥测都没有——零网络请求(本机模型除外),这也是营销承诺("nothing leaves your machine")的字面事实。P1 接 SaaS 埋点时按 [18 §3](18-testing-and-quality.md) 白名单流程放宽,并同步修改营销文案的表述边界。

## 5. 部署加固(HTTP 托管时)

本地 `file://` 双击场景不加 CSP(`'self'` 匹配有坑);正式 HTTP 托管时在响应头加纵深防御:

```
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline';
  style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'none';
  object-src 'none'; base-uri 'none'; frame-ancestors 'none'
```

注意:`connect-src 'none'` 与本机模型连接器互斥——托管版若保留连接器需改为 `connect-src http://127.0.0.1:*`;接入 SaaS 后按白名单逐项列出。上 HTTPS 后补 `Strict-Transport-Security`。

## 6. 相关文档

- 断言的运行与修改流程:[18 测试与质量规范](18-testing-and-quality.md)
- 连接器实现细节(SSE/打断语义/CORS):[16 本地 AI 接入网页](16-local-ai-web-integration.md)
- 为什么这样设计(决策记录):[17 §8](17-repo-architecture-and-conventions.md)
