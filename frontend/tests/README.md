# frontend/tests — 本地安全测试

确保前端代码没有注入类漏洞,并在以后改动时自动抓回归。

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
| `security.test.js` | 静态扫描 + `esc()` 单元测试 + 数据流与网络边界断言(83 项) |
| `xss.browser.html` | 无头浏览器里向真实 `chat.js` 投喂 XSS payload,验证被当作纯文本 |
| `run.sh` | 串起两者,输出汇总与退出码 |

具体断言:

- **危险 API**:无 `eval` / `new Function` / `document.write` / 字符串定时器 / `outerHTML` / `insertAdjacentHTML`。
- **零外部依赖面**:无 `fetch/XHR/WebSocket`(纯静态站不发网络请求);所有 `<script>`/`<link>`/图片均为本地相对路径,无远程资源。
- **注入向量**:无 `javascript:` URL;无 `target=_blank` 缺 `rel=noopener`;无硬编码密钥/私钥/令牌(界面里的 `sk-local-••••` 是打码占位,非真实 key)。
- **XSS 核心**:直接对 `chat.js` 里真实的 `esc()` 跑五组攻击载荷,确认 `<`、`"`、`&` 全被转义;并断言用户输入经 `esc()` 后只用 `textContent` 渲染,绝不进原始 `innerHTML`。
- **生成器**:`build.js` 不把自由文本需求框读进安装包/手册内容。
- **存储**:`i18n` 的 localStorage 只存语言码。

## 为什么安全面这么小

这是**纯前端静态站**:没有后端、不发网络请求、不用 `eval`。唯一的用户输入入口是聊天页输入框(会回显),已用 `esc()` + `textContent` 双重防护。安装包/手册/聊天回答都来自受控的静态数据,不含可被注入的自由文本。

## 部署到 HTTP 时的加固建议(可选)

本地 `file://` 双击打开时不建议加严格 CSP(`file://` 的 `'self'` 匹配有坑,可能反而加载不了同目录脚本)。**若日后用 HTTP 托管**,建议在服务器响应头加一层 CSP 作为纵深防御,例如:

```
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline';
  style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'none';
  object-src 'none'; base-uri 'none'; frame-ancestors 'none'
```

(当前用到内联 `onclick`/`style`,故脚本/样式暂留 `'unsafe-inline'`;`connect-src 'none'` 可挡住任何数据外发。)
