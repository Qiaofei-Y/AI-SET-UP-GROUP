# frontend/tests — 本地安全测试

确保前端代码没有注入类漏洞,并在以后改动时自动抓回归。

> 规范文档:提交门槛与断言修改流程见 [docs/18 测试与质量规范](../../docs/18-testing-and-quality.md);这些断言背后的威胁模型与不变量见 [docs/19 安全模型](../../docs/19-security-model.md)。

## 运行

```bash
bash frontend/tests/run.sh
```

- 只需 **Node**(静态 + 单元测试,零依赖)。
- 若装了 Chrome/Chromium,会额外跑一个**真实浏览器 XSS 攻击测试**;没有则自动跳过(转义已由单元测试覆盖)。
- 任一测试失败,退出码为 `1`(可直接用于 CI / pre-commit)。

也可单独跑:`node frontend/tests/security.test.js`

## 覆盖什么

| 文件 | 内容 |
|------|------|
| `security.test.js` | 静态扫描 + `esc()` 单元测试 + 数据流与网络边界断言 + `pickModel`↔`registry.json` 同步校验(90 项) |
| `xss.browser.html` | 无头浏览器里向真实 `chat.js` 投喂 XSS payload,验证被当作纯文本 |
| `ui.smoke.sh` | 无头浏览器逐页加载全部 11 个页面(自起随机端口 http.server):动效层初始化(`data-fx="on"`)、顶栏存在、console 零错误 |
| `run.sh` | 串起三者,输出汇总与退出码 |

具体断言:

- **危险 API**:无 `eval` / `new Function` / `document.write` / 字符串定时器 / `outerHTML` / `insertAdjacentHTML`。
- **零外部依赖面**:除按精确路径豁免的 `assets/local-llm.js` 外,任何文件出现 `fetch/XHR/WebSocket` 即失败;连接器内每个 fetch 必须以四常量(`BASE`/`PORTAL`/`ADVISOR` 钉死 `127.0.0.1`;`API` 为锁形条件式:本地页回环、部署页同源 `''`)之一开头;所有 `<script>`/`<link>`/图片均为本地相对路径,无远程资源。
- **注入向量**:无 `javascript:` URL;无 `target=_blank` 缺 `rel=noopener`;无硬编码密钥/私钥/令牌(界面里的 `sk-local-••••` 是打码占位,非真实 key)。
- **XSS 核心**:直接对 `chat.js` 里真实的 `esc()` 跑五组攻击载荷,确认 `<`、`"`、`&` 全被转义;并断言用户输入经 `esc()` 后只用 `textContent` 渲染,绝不进原始 `innerHTML`。
- **生成器**:`build.js` 不把自由文本需求框读进安装包/手册内容。
- **存储**:`i18n` 的 localStorage 只存语言码。
- **数据一致性**:`build.js` `pickModel()` 的三个档位与 `backend/api/registry.json` 逐字段比对(name/file/repo/quant/体积),改一侧不改另一侧会直接挂测试。

## 为什么安全面这么小

这是**零依赖静态站 + 单一联网文件**:除 `local-llm.js`(只连 `127.0.0.1` 本机服务:llm-lab 与自建 API)外无任何网络路径,不用 `eval`。用户输入入口只有聊天框(回显)、向导需求框(write-only,生成链路不读)和注册表单(只发本机 API,不进 DOM),全部经 `esc()` + `textContent` 或结构性隔离防护。安装包/手册/聊天演示回答都来自受控数据。后端自身的红线由 `backend/tests/api.test.py` 另行强制(见 docs/20 §8)。

## 部署到 HTTP 时的加固建议(可选)

本地 `file://` 双击打开时不建议加严格 CSP(`file://` 的 `'self'` 匹配有坑,可能反而加载不了同目录脚本)。**若日后用 HTTP 托管**,建议在服务器响应头加一层 CSP 作为纵深防御,例如:

```
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline';
  style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'none';
  object-src 'none'; base-uri 'none'; frame-ancestors 'none'
```

(当前用到内联 `onclick`/`style`,故脚本/样式暂留 `'unsafe-inline'`;`connect-src 'none'` 可挡住任何数据外发——若按 docs/22 P0-13 做同源部署、`/v1/*` 反代到后端,则改为 `connect-src 'self'`。)
