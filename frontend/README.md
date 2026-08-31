# frontend/ — 可用的多页网站

真正可运行的网站(不是设计稿)。双击 `index.html` 用浏览器打开即可。

## 页面

| 文件 | 作用 |
|------|------|
| `index.html` | **营销首页(宣传)**:Hero(流式产品截图)→ 数据条 → 怎么运作 → 核心能力 → 模板库 → 部署方式 → 适合谁 → 场景成效 → 价格 → CTA(内容结构参考腾讯云 ADP 的企业级叙事,定位仍是"拥有私有 AI") |
| `how-it-works.html` | **怎么运作(独立页)**:四步流程详解 + "你永远不用碰的东西" + 常见问题 |
| `capabilities.html` | **核心能力(独立页)**:六大模块详解 + 模块协同流程 |
| `templates.html` | **模板库(独立页)**:六个模板卡(示例问题)+ 模板内含说明 + 空白需求入口 |
| `deploy.html` | **部署方式(独立页)**:本地/云端/混合详解 + 场景选型对照 |
| `pricing.html` | **价格(独立页)**:Beta 免费横幅 + 三档价格 + 价格常见问题 |
| `build.html` | **引导流程**:需求(6 个模板,与模板页一致)→ 设备 → 推荐方案 → 本地/云端/混合 → 生成**真实可用**的 Ollama 引导安装包 + 分步指南 / 云端手册(混合两者都给);SmartScreen 提示、人话版预览(可切原始脚本)、「即将推出」诚实徽标 |
| `dashboard.html` | **Control Center 预览**:装好后的管理界面(模型/运行状态/知识库/API/Teach My AI),**全页示例数据并明确标注**;唯一真实卡是**「账号」自助卡**(改密并撤销其他 session、全设备登出、导出 JSON、文件级删除账号——隐私政策的可执行形式);未登录出登录墙(P0-14) |
| `chat.html` | **可交互对话演示**:输入或点建议问题 → AI 流式回答 + 来源引用(小样本知识库,示例内容明确标注;纠正/拖放为预览,不假装学习或索引) |
| `signup.html` | **注册/登录页**:Pro/Business 创建免费账号(Beta 期已上线功能全部免费,无门禁宣称);`?plan=business` 时多一个公司名字段,`?mode=login` 切登录;注册需勾选条款(clickwrap,服务端留痕);账号走本机 API(users.db),**API 离线时显式报错、不假装成功** |
| `account.html` | **账号设置页**:改邮箱/改密码、匿名统计开关、导出数据、全设备登出、删除账号——全部走本机 API(`__bmaAuth`/`__bmaConsent`);默认出登录墙,仅在 `/v1/auth/me` 确认会话后放行(P0-14) |
| `forgot-password.html` / `reset-password.html` / `verify-email.html` | **账号找回三件套(P0-15)**:申请重置链接 / 用链接设新密码 / 邮箱验证;链接 token 客户端校验形态,走本机 API;不泄露账号是否存在,离线显式报错、视图切换时移焦到新标题 |
| `checkout-success.html` / `checkout-cancel.html` | **Stripe 托管结账回跳页**:成功页轮询 `/v1/auth/me` 直到套餐生效再放出「前往控制中心」CTA(webhook 未落地/未登录/401 时诚实说明,绝不假升级);取消页给回价格入口 |
| `404.html` | **未找到页**:双语,回首页/主要入口 |
| `privacy.html` / `terms.html` / `refunds.html` | **法律三件套(草案)**:隐私政策 / 服务条款 / 退款政策,双语,带「待律师审阅」横幅;全站页脚可达(docs/22 P0-5) |

## 代码分割(CSS / JS 各司其职)

HTML 只放内容,样式和逻辑全部拆到 `assets/`,每个页面只加载自己需要的文件:

| 文件 | 说明 | 被谁加载 |
|------|------|----------|
| `assets/base.css` | 设计系统:变量、导航、按钮、页脚、共享组件(badge/meter/switch)、共享动画 | **所有页面** |
| `assets/home.css` | 营销页共用:Hero/子页 Hero、各营销区块、模板/部署/场景卡 | index + 五个独立营销页 |
| `assets/build.css` | 向导专属:步骤条、表单、推荐卡、生成输出 | build |
| `assets/dashboard.css` | 控制中心专属:导航栏、状态条、卡片网格 | dashboard |
| `assets/chat.css` | 聊天页专属:消息气泡、输入栏、建议问题 | chat |
| `assets/signup.css` | 注册/登录页专属:表单卡、错误提示、clickwrap 勾选、成功视图 | signup |
| `assets/legal.css` | 法律页共用:文章排版、草案横幅、摘要卡 | privacy + terms + refunds |
| `assets/fx.css` | 共享动效层:辉光/网格/扫描线变量 + 工具类(reveal/卡片微倾/按钮流光/描边环),页尾 reduced-motion 总闸 | **所有页面** |
| `assets/fx.js` | 共享动效引擎:滚动 reveal、指针微倾、数字滚动、粒子星网 canvas、`FX.decode` 文字解码;初始化后设 `data-fx="on"` | **所有页面** |
| `assets/favicon.svg` | 品牌 ◆ 图标(本地 SVG,`<link rel="icon">`) | 所有页面 |
| `assets/i18n.js` | 中英文切换(默认英文,跨页面记忆) | 所有页面 |
| `assets/hero.js` | 首页 Hero 截图的流式打字动画 | index |
| `assets/build.js` | 向导逻辑 + **真实 Ollama 安装包/指南/云端手册生成器**(纯 cmd batch,零 PowerShell;Llama 模型自动附 "Built with Llama" 许可注记);内置 registry 镜像 `MODELS` 表(含 `ollama` 钉版标签),`pickModel(vram, need)` 按需求加权选模型(与后端同规则,测试锁同步) | build |
| `assets/chat.js` | 聊天逻辑 + 小样本 RAG 知识库(流式回答 + 引用) | chat |
| `assets/signup.js` | 注册/登录逻辑:本地校验 + `__bmaAuth` 真实注册/登录;API 不可达时显式报错(无假通行,P0-14) | signup |
| `assets/account.js` | 账号设置控制器:`__bmaAuth`/`__bmaConsent` 驱动改邮箱/改密码/导出/全设备登出/删除;单飞防抖(`acctBusy`)、401 失败回登录墙、全 textContent 渲染 | account |
| `assets/auth-recovery.js` | 找回三页逻辑(forgot/reset/verify):token 形态校验、防重复提交、离线/限流/过期分支、视图切换移焦 | forgot-password + reset-password + verify-email |
| `assets/checkout.js` | 结账成功页:轮询 `/v1/auth/me` 确认套餐(webhook 迟到/未登录/401 诚实降级),终态移焦 | checkout-success |
| `assets/auth-nav.js` | 全站导航登录态:有效会话时把「Log in」换成「Account」,失败/离线保持「Log in」(fail-closed) | 多数含导航的页面 |
| `assets/local-llm.js` | 可选:本地连接器,全站唯一联网文件(llm-lab 只连 `127.0.0.1`,后端 API 本地页连 `127.0.0.1:8940`、部署页走同源 `/v1/*`;chat:项目 RAG > 通用聊天 > 演示,👍/👎 上报后端;build:需求框由本地 AI 分类选卡,方案步骤走后端 `/v1/advise`;auth:`__bmaAuth` 供注册/登录/登录态/找回/账号自助端点,`__bmaBilling` 供 Stripe 托管结账/账单门户,`__bmaConsent` 管本机匿名统计开关;chat 回退档接 Ollama 11434) | chat + build + signup + dashboard + account + 找回三页 + 结账回跳页 |

原则:**共享的进 `base.css`;页面专属的进各自的 CSS;不同功能的 JS 拆成独立文件。** 加新页面时,加载 `base.css` + 一个页面专属 CSS 即可。完整工程约定(i18n 规则、全局钩子清单、文档镜像规则)见 [docs/17](../docs/17-repo-architecture-and-conventions.md)。

## 动线

首页(宣传)→ 引导流程(生成安装包/手册)→ 控制中心预览 → 在线对话体验,页面互相链接,形成完整闭环。顶部导航(How it works / Capabilities / Templates / Deploy / Pricing)跳转各自的独立营销页(带当前页高亮),不再是首页锚点滚动。

## 接本地模型(可选,含项目知识库 RAG)

chat.html 加载时自动探测本机 llm-lab,按可用性走三档(详见 [docs/16](../docs/16-local-ai-web-integration.md)):

1. **项目 RAG**(8080 + 8090 门户都在):回答从本项目文档检索生成,带引用卡(文件 + 章节),检索不到自动降级;
2. **通用聊天**(仅 8080):Qwen 流式回答,多轮上下文(最近 12 条);
3. **Ollama 回退**(8080 不在、11434 在):引导安装包装好的引擎直接接入聊天——装完就能在这里对话;llm-lab 恢复后自动切回;
4. **静态演示**(都不在):内置小样本答案,页面功能不变。

```bash
ai                                # 启动 llm-lab(8080 聊天 / 8081 向量 / 8090 门户)
cd ~/AI-SET-UP-GROUP/frontend
python3 -m http.server 8931       # 必须走 http:// 访问(fetch 不能用 file://)
open http://localhost:8931/chat.html
```

- **build.html 的需求框也接了本地 AI**:输入一句话,由本地模型分类到六个模板之一并自动选卡。分类优先走**预留顾问端口 `127.0.0.1:8092`**(在这个端口起任意 OpenAI 兼容服务即可接管,如 `llama-server --port 8092`),没有则回退 8080 聊天模型;两个都不在就保持纯演示(手动选卡)。
- **后端 API(可选,`python3 backend/api/server.py`,127.0.0.1:8940)**:在线时向导"推荐方案"改由 `/v1/advise` + 模型库 registry 给出(方案卡带"✦ 实时推荐 · 模型库"标识,生成文件与其一致);点"生成文件"匿名上报 `/v1/telemetry/deploy`(`stage:'plan_generated'`);聊天页 👍/👎 上报 `/v1/feedback`(只传 评分+模板+模型 id,**绝不传内容**,且仅在真实本地模型回答时上报);注册/登录/登录态走 `/v1/auth/*`(账号落本机 `users.db`)。向导/遥测/反馈离线自动回退纯前端、页面功能不变;**auth 例外**——离线显式报错、dashboard 出登录墙,不假通行(docs/22 P0-14)。
- 文档改动后更新知识库:`ai ingest ~/AI-SET-UP-GROUP`;彻底重建:`ai reindex ~/AI-SET-UP-GROUP`。
- 安全边界由测试保证:`local-llm.js` 是全站唯一允许网络请求的文件(按精确路径豁免),且只许指向 `127.0.0.1`(见 `tests/security.test.js`,192 项;含全站 i18n 双语配对断言)。需求框文本只会发往 `127.0.0.1`,且永远不会进入生成的安装包/手册(`build.js` 不读框值,由测试强制)。

## 说明

- 默认是**纯前端演示**:安装包/手册在浏览器里生成,聊天回答来自本地小样本知识库,无需任何服务。llm-lab 在线时聊天页自动切换真实模型;后端 API 在线时向导推荐与反馈上报自动增强(见上节)——三者互相独立,谁在线用谁;营销/向导/聊天全部离线也完整可用,只有账号功能(注册/登录/Control Center)需要后端在线。
- 设计与 `../figma/`(界面原型)、`../docs/11-*`(为什么顾问用 API、本地/云端)一致。
