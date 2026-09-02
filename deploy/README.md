# 部署运行手册 (deploy runbook)

把「同源部署」拓扑落到一台服务器上:一个域名同时服务静态前端与 `/v1/*` API,反代终结 TLS 并把 `/v1/*` 转给只绑回环的后端(docs/20 §3.1)。前端 `local-llm.js` 的 `API` 常量在非 localhost 域名下自动解析为 `''`(同源相对路径)——**前端零配置,同一份静态文件本地与生产通用**。

本目录提供:

| 文件 | 作用 |
|---|---|
| `Caddyfile` | 反代 + 自动 HTTPS + 安全响应头(推荐,最省事) |
| `nginx.conf` | 等价 nginx 配置(用 certbot 出证书) |
| `systemd/buildmyai-api.service` | 后端进程(`127.0.0.1:8940`,注入密钥,沙箱化) |
| `systemd/buildmyai-backup.service` + `.timer` | 每 30 分钟数据库备份(见 `backend/ops/backup.py`) |
| `healthcheck.sh` | 上线后冒烟脚本:curl `/v1/health` + 校验首页 CSP/HSTS/nosniff 响应头,退出码非 0 即不健康(可接告警) |

安全响应头(CSP 等)照 docs/19:`default-src 'self'`;脚本/样式允许 `'unsafe-inline'`(站内用内联 `onclick`/`style`,从不加载远程脚本);`connect-src` 同时放行 `'self'`(同源 `/v1/*`)与 `http://127.0.0.1:* http://localhost:*`(`local-llm.js` 连本机模型引擎——浏览器视 `127.0.0.1`/`localhost` 为安全源,不算混合内容);`object-src/base-uri/frame-ancestors` 全锁死;上 HTTPS 后加 `Strict-Transport-Security`。

## 上线步骤

1. **放代码**:把仓库放到 `/srv/buildmyai`(前端在 `frontend/`,后端在 `backend/`)。建一个非特权用户 `bma`、数据目录 `backend/api/data` 与备份目录 `/var/backups/bma`,都 `chown bma:bma`。数据目录必须预先建好:`buildmyai-api.service` 用 `ProtectSystem=strict` 把 `/srv` 设为只读、仅 `ReadWritePaths` 例外,进程无法自建该目录。
2. **占位替换**:
   - 把 `Caddyfile` / `nginx.conf` / 两个 systemd 文件里的 `buildmyai.example.com` 换成真实域名。
   - `frontend/sitemap.xml` 里所有 `https://__DOMAIN__` 换成真实域名;`frontend/robots.txt` 末尾的 `Sitemap:` 行取消注释并填域名。
3. **注入密钥**(改 `buildmyai-api.service` 的 `Environment=`):
   - `BMA_ADMIN_SECRET`=真实随机串(**必填**;默认串会拒绝非回环绑定,且任何环境下都不安全)。
   - 发信:`BMA_SMTP_HOST/USER/PASS` 指向 Amazon SES 的 SMTP 端点(不填则走 dev/stdout,不真正外发);`BMA_SITE_URL` 设为真实域名(邮件里找回/验证链接的基址)。
4. **起后端**:`sudo cp systemd/buildmyai-api.service /etc/systemd/system/ && sudo systemctl daemon-reload && sudo systemctl enable --now buildmyai-api`。后端只绑 `127.0.0.1:8940`,TLS/HTTP2/排队全交给反代。
5. **起反代**:Caddy——把 `Caddyfile` 放到 `/etc/caddy/` 并 `sudo systemctl reload caddy`(自动签发证书);或 nginx——`nginx.conf` 入 `sites-enabled` 后 `sudo certbot --nginx -d <域名>`。
6. **开备份**:`sudo cp systemd/buildmyai-backup.* /etc/systemd/system/ && sudo systemctl daemon-reload && sudo systemctl enable --now buildmyai-backup.timer`。要加密快照就设 `BMA_BACKUP_KEY`;要异地就设 `BMA_BACKUP_S3`(需 `aws` CLI + 凭据)。

## 验收

- 一键冒烟:`deploy/healthcheck.sh https://<域名>`(退出码 0 = 健康;它替你跑下面两条并校验 CSP/HSTS/nosniff)。
- `curl -fsS https://<域名>/v1/health` → `{"ok": true, ...}`(TLS 下 200)。
- 浏览器打开首页 → 响应头含上面的 CSP + HSTS(`curl -sI https://<域名>/ | grep -i content-security`)。
- 陌生人可 注册 →(收验证信)→ 登录 → 控制中心。
- 恢复演练:`python3 backend/ops/backup.py --selftest` 退出码 0(CI 每次也会跑)。

## 仍需人工(代码之外)

- 支持渠道邮箱;需要时律师审阅法律文件。
- 代码签名证书(周期长);把结构化日志的 `warn/error` 接入真实告警(PagerDuty/邮件)。
- GitHub 仓库设置:对 `main` 开 branch protection,把 CI 两个 check 设为 required(红则挡合并)。
