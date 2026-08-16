# 14 · 用户引导与激活 Playbook(如何引导用户 · Build My AI)

> 面向对象:产品、增长、设计、内容、支持团队。
> 目标:让一个**零技术背景**的新用户,从第一次落地到"用自己的私有 AI 得到第一个带来源的正确回答",走得又快又顺。
> 产品默认语言:**英文(美国市场)**;本文档为中文说明,所有可直接上线的 UI/邮件文案给出 **EN(主)/ 中(备)** 双语。

---

## 0 · TL;DR(一页看懂)

- **North Star Metric(北极星指标)**:每周从自己私有 AI 得到**有用(带来源)回答**的活跃用户数。
- **Aha moment(激活定义)**:新用户在**首次会话 30 分钟内**,**拖入 ≥1 个文档**并得到**一个带来源引用的正确回答**。
- **引导的唯一使命**:把新用户尽快、尽可能无摩擦地推到这个 Aha moment,然后用留存回路让他每周回来。
- **核心心法**:免注册即可用(Free)、零技术名词(用"质量/速度/占用"代替 VRAM/量化)、每一步有默认最优解、失败可恢复、没文档也能靠演示模式体验。
- **升级时机**:不是一上来就要钱,而是在用户**已经尝到价值**(第 N 个文档、想微调、想接 API、想多设备)时自然提示;Beta 期间全部免费,但 Pro/Business 需注册解锁。

---

## 1 · 引导目标与激活定义

### 1.1 为什么 Aha 是"带来源的第一个答案"

Build My AI 的价值主张是:**一个完全属于你、读你自己资料、还能告诉你答案出处的私有 AI**。这句话里有三个不可替代的要素:

1. **私有**——数据不出设备(安装成功即证明)。
2. **懂我的资料**——AI 能回答关于用户自己文档的问题(拖入文档即证明)。
3. **可信**——答案带来源引用,用户能核对"这句话来自哪份文件第几页"(带来源回答即证明)。

只有当这三件事在**同一次会话里**同时发生,用户才会真正"相信"这个产品不是又一个通用聊天机器人。因此我们把 Aha 精确定义为:

> **首次会话 30 分钟内,拖入 ≥1 个文档,并得到一个带来源引用的正确回答。**

- **"带来源"是硬条件**:一个没有引用的答案,和 ChatGPT 无异,无法证明"读了我的资料"。来源标签(如 *"来自《2024采购合同.pdf》第 3 页"*)才是差异化的"证据"。
- **"30 分钟内"是速度约束**:超过这个时长,新用户流失概率陡增;它倒逼我们把安装、拖文档、首问答的总摩擦压到最低。
- **"正确"允许软判定**:我们无法保证语义 100% 正确,但可以用代理信号近似——用户没有立即离开、追问了下一个问题、或点了"👍 有用 / This helped"。

### 1.2 激活的分层定义

| 层级 | 名称 | 定义 | 用途 |
|------|------|------|------|
| L0 | 落地(Landing) | 访问 index.html | 流量口径 |
| L1 | 意向(Intent) | 点击 "Build My AI" 进入 build.html | 意向漏斗起点 |
| L2 | 装成(Setup Done) | 本地安装成功 / 云端手册已打开控制中心 | 技术门槛通过 |
| L3 | **激活(Activated / Aha)** | 拖 ≥1 文档 + 得到带来源回答 | **核心指标** |
| L4 | 习惯(Habituated) | 一周内 ≥3 天回来提问 | 留存先导 |
| L5 | 价值(Value) | 触发 North Star:每周得到有用(带来源)回答 | 北极星 |

> 设计原则:**一切引导都为把最多的 L1 推到 L3 服务**;L4/L5 由留存机制(见 §6)承接。

---

## 2 · 激活漏斗全景

从落地页到激活,每一步都是一个可能流失的关口。下表列出**完整步骤、预计流失原因、对策、以及对应 UI 文案位置**。

### 2.1 主漏斗表(落地 → Aha)

| # | 步骤 | 页面 | 用户动作 | 主要流失原因 | 对策 | 关键文案位 |
|---|------|------|----------|--------------|------|-----------|
| 1 | 落地 | index.html | 阅读首页 | 不懂"私有本地 AI"有什么用 | 首屏一句话价值 + 30 秒演示视频 + "无需注册即可开始" | Hero 标题/副标题 |
| 2 | 点 Build | index.html → build.html | 点 "Build My AI" | 担心"要装很复杂的东西" | 按钮旁副文案:"用大白话回答几个问题,3 分钟出方案" | 主 CTA |
| 3 | 需求描述 | build.html 屏1 | 一句话写需求或选场景 | 面对空输入框不知写什么 | 预置场景卡片 + 示例占位符,可零输入直接选 | "What do you want your AI to do?" |
| 4 | 设备检测 | build.html 屏2 | 确认/填写电脑信息 | 不知道自己的 GPU/内存是什么 | 自动检测 + 人话("你的电脑:快 / 中 / 需要云端");检测失败给"我不确定"选项 | "Tell us about your computer" |
| 5 | 看推荐 | build.html 屏3 | 查看推荐方案 | 看不懂模型名/参数 | 只显示"质量 / 速度 / 占用"三条;技术细节收进"高级模式" | "Your recommended setup" |
| 6 | 选本地/云端 | build.html 屏4 | 选运行位置 | 纠结选哪个 | 按检测结果**预选**最优项 + 一句话解释各自代价 | "Where should it run?" |
| 7 | 下载/看手册 | build.html 屏5 | 下载安装包 or 打开云端手册 | 下载慢/杀毒拦截/云手册看不懂 | 进度可视化 + 校验说明 + 云手册分步骤配图 | "Your local installer is ready" |
| 8 | 安装 | 安装器 / 云端 | 运行安装 | 安装失败(驱动/空间/端口/网络) | 人话失败恢复(见 §4.4)+ 一键重试 + 复制诊断信息 | 安装进度屏 |
| 9 | 打开控制中心 | dashboard.html | 首次打开 Dashboard | 面对空控制台不知先做什么 | 首屏强引导:一个大号"拖入你的第一个文档" | Dashboard 空状态 |
| 10 | 拖第一个文档 | dashboard.html 📚 | 拖 PDF/Word/Excel | 手边没文档 / 拖了不知道成没成 | 演示模式 + 示例文档;拖入后显示"已索引,可以问了" | 知识库空状态 |
| 11 | 首次提问 | chat.html / Dashboard 对话 | 问第一个问题 | 不知道能问什么 | 一键示例问题(基于刚拖入的文档自动生成) | 对话空状态建议气泡 |
| 12 | **带来源回答 → Aha** | 对话 | 读到带引用的答案 | 答案没来源 / 来源不准 | 强制渲染来源标签 + "庆祝"微交互 + 引导追问 | 来源徽标 + 庆祝条 |

### 2.2 漏斗量化预期(用于设埋点基线与告警)

> 以下为**规划期假设值**,上线后用 docs/13 的事件数据替换。重点是识别"最大漏点"并集中投入。

| 关口 | 假设转化率 | 是否重点漏点 | 备注 |
|------|-----------|-------------|------|
| 落地 → 点 Build | 20–30% | 中 | 首页说服力 |
| 点 Build → 完成向导(出方案) | 55–70% | 中 | 向导太长会掉 |
| 出方案 → 装成(L2) | 40–60% | **高(本地端)** | 安装失败是最大技术漏点 |
| 装成 → 拖第一个文档 | 60–75% | 中 | 空状态引导决定成败 |
| 拖文档 → 首次提问 | 70–85% | 低 | 示例问题降门槛 |
| 首次提问 → 带来源回答(L3) | 75–90% | 中 | 依赖 RAG/引用质量 |

**结论**:本地安装(#8)和向导完成率(#3–7)是两个最需要投入的地方;云端路径把技术漏点转移到"手册可读性"上。

---

## 3 · 首次体验设计(FTUE · 逐屏)

设计规范延续产品调性:**LangChain 风格**(暖米白背景 + 青绿强调 + 等宽标签),双语默认英文,对用户**零技术名词**。以下逐屏给出目标、结构、和可直接上线的引导文案(EN 主 / 中 备)。

### 3.1 屏 0 · 欢迎 / 需求(build.html 屏1)

**目标**:让用户 10 秒内开始,不被空输入框劝退。

- 结构:一个大输入框 + 4–6 张预置场景卡(点卡即自动填入需求)。
- 允许**零输入**:用户可以只点一张卡直接"Next"。

**文案示例**

| 位置 | EN(主) | 中(备) |
|------|---------|---------|
| 标题 | What do you want your AI to do? | 你想让你的 AI 做什么? |
| 副标题 | Answer a few plain-English questions. No tech knowledge needed. | 用大白话回答几个问题,不需要任何技术知识。 |
| 输入占位 | e.g. "A private AI that reads my company PDFs and answers questions" | 例如:"一个能读我公司 PDF 并回答问题的私有 AI" |
| 场景卡 | Company knowledge · Research & docs · Contracts & legal · Finance & spreadsheets · Customer support · Just exploring | 公司知识 · 研究资料 · 合同法务 · 财务表格 · 客户支持 · 先随便看看 |
| 主按钮 | Next: check my computer → | 下一步:检测我的电脑 → |

### 3.2 屏 1 · 设备检测(说人话)(build.html 屏2)

**目标**:让用户信任"我们能帮他判断电脑够不够",而不是逼他理解硬件。

- 自动检测 CPU / 内存 / 显卡 / 系统 / 磁盘,**结果翻译成三档人话**:`Fast on this computer / Works, a bit slower / Better in the cloud`。
- 检测不到或用户不确定时,给"I'm not sure / 我不确定"按钮,走保守推荐。

**文案示例**

| 位置 | EN | 中 |
|------|----|----|
| 标题 | Tell us about your computer | 说说你的电脑 |
| 检测结果(好) | Good news — your computer can run this fast. | 好消息——你的电脑可以流畅运行。 |
| 检测结果(中) | This will work. It may answer a little slower. | 可以运行,回答可能稍慢一点。 |
| 检测结果(需云) | This one's heavy for your computer — we'll suggest the cloud. | 这个对你的电脑有点吃力——我们会建议用云端。 |
| 不确定入口 | Not sure? Let us pick something safe. | 不确定?让我们帮你选个稳妥的。 |
| 主按钮 | See my recommendation → | 查看我的推荐方案 → |

> 反面示例(禁止):"检测到 8GB VRAM,建议 Q4_K_M 量化"。**正面**:"你的电脑内存中等,我们会挑一个又快又省空间的方案。"

### 3.3 屏 2 · 推荐方案(质量/速度/占用)(build.html 屏3)

**目标**:让用户看得懂、敢选。技术细节全部**默认折叠**进"Advanced / 高级模式"。

- 只呈现三个维度的可视条:**Quality 质量 · Speed 速度 · Disk 占用**。
- 一句话说明"为什么推荐它"。

**文案示例**

| 位置 | EN | 中 |
|------|----|----|
| 标题 | Your recommended setup | 为你推荐的方案 |
| 三维标签 | Quality · Speed · Space used | 质量 · 速度 · 占用空间 |
| 推荐理由 | Best balance of accuracy and speed for your computer. | 在你的电脑上,准确度和速度最平衡的选择。 |
| 高级入口 | Advanced options ▾ (model, quality level, memory) | 高级选项 ▾(模型、精度、内存) |
| 主按钮 | Looks good → | 就它了 → |

### 3.4 屏 3 · 本地/云端(build.html 屏4)

**目标**:让用户在"私有 vs 省事"之间做一个**有默认预选**的简单选择。

**文案示例**

| 选项 | EN 说明 | 中 说明 |
|------|---------|---------|
| Run on my computer(**私有优先默认**) | Your data never leaves this device. Download an installer. | 数据永不离开这台设备。下载安装包。 |
| Run in the cloud | Nothing to install. We'll give you a step-by-step guide. | 无需安装。我们给你一份分步骤手册。 |
| 标题 | Where should it run? | 让它在哪里运行? |
| 主按钮 | Generate my files → | 生成我的文件 → |

### 3.5 屏 4 · 安装进度(人话 + 可重试)

**目标**:让"装东西"这件让非技术用户焦虑的事变得透明、可控、可恢复。

- 每一步显示"在做什么(人话)+ 预计剩余时间"。
- 任何一步失败:**红条 + 一句人话原因 + [重试] + [复制诊断信息]**,绝不出现堆栈报错。

**文案示例(进度步骤,人话)**

| 内部步骤 | 用户看到的 EN | 用户看到的 中 |
|----------|--------------|--------------|
| 下载运行时 | Setting up the engine… | 正在准备运行引擎… |
| 下载模型权重 | Downloading your AI's brain (this is the big one)… | 正在下载 AI 的"大脑"(这一步最大)… |
| 装 RAG 组件 | Teaching it to read your files… | 正在让它学会读你的文件… |
| 启动 Web UI | Almost there — opening your control center… | 就快好了——正在打开你的控制中心… |
| 成功 | ✅ Your private AI is ready. | ✅ 你的私有 AI 准备好了。 |

### 3.6 屏 5 · 打开即引导拖第一个文档(dashboard.html 空状态)

**目标**:安装/云端手册完成后,Dashboard 第一眼就把用户推向"拖文档"。

- 大号拖拽区 + 一行召唤 + "没有文档?试试演示"。

**文案示例**

| 位置 | EN | 中 |
|------|----|----|
| 主召唤 | Drop your first file here — a PDF, Word, or Excel. | 把你的第一个文件拖到这里——PDF、Word 或 Excel。 |
| 副文案 | Your AI will read it privately. Nothing is uploaded. | 你的 AI 会私密地读它。不会上传任何东西。 |
| 无文档出口 | No file handy? Try it with a sample → | 手边没文件?用示例试试 → |

### 3.7 屏 6 · 一键示例问题(对话空状态)

**目标**:拖完文档后,用户常"不知道能问什么"。基于刚索引的文档**自动生成 3–4 个示例问题**,一键提问。

- 复用 chat.html 已有的示例问句风格(如 "What's the payment cycle with Supplier A?")。

**文案示例(示例问题气泡,EN)**

- "Summarize this document in 3 bullets."
- "What are the key dates or deadlines here?"
- "What's the payment cycle with Supplier A?"(合同类)
- "Who approves a $20,000 purchase?"(流程类)

中备:"用 3 点总结这份文档" · "这里有哪些关键日期或截止时间?"

### 3.8 屏 7 · 庆祝首次带来源回答(Aha 时刻)

**目标**:当第一个**带来源**答案出现时,给一个轻量"庆祝"微交互,把这一刻**标记为里程碑**,并顺势引导下一步(追问 / 纠正 / 再拖一个文档)。

- 来源标签**必须渲染**:`Source: 2024-contract.pdf · p.3`。
- 庆祝条一次性出现,不打扰后续对话。

**文案示例**

| 位置 | EN | 中 |
|------|----|----|
| 庆祝条 | 🎉 That answer came from *your* document — with the exact source. This is your private AI working. | 🎉 这个答案来自*你自己的*文档——还标了确切来源。这就是你的私有 AI 在工作。 |
| 来源徽标 | Source: {filename} · p.{n} | 来源:{文件名} · 第 {n} 页 |
| 引导追问 | Ask a follow-up, or drop another file to make it smarter. | 追问一句,或再拖一个文件让它更聪明。 |
| 反馈按钮 | 👍 Helpful · ✍️ Fix this answer | 👍 有用 · ✍️ 纠正这个回答 |

---

## 4 · 降低摩擦的手段

### 4.1 免注册即可用(Free)

- **Free 无需注册即可完整走完**:落地 → 向导 → 安装 → 拖文档 → 首问答 → Aha,全程不要求账号。
- 注册只在**解锁 Pro/Business 功能**(微调、API、多设备、团队)时才要求;这样注册墙不会挡在 Aha 之前。
- 后台仅收**匿名**使用数据(与 docs/13 对齐),用于漏斗分析。

**文案示例**

| 位置 | EN | 中 |
|------|----|----|
| 首页信任条 | Start free. No account, no credit card. | 免费开始。无需账号,无需信用卡。 |
| 注册墙(仅高级功能) | This is a Pro feature. During Beta it's free — just create an account to unlock. | 这是 Pro 功能。Beta 期间免费——注册即可解锁。 |

### 4.2 演示 / 示例模式(没文档也能体验)

- 为"手边没文档"的用户提供**演示模式**:预置一份示例文档(如样例采购合同 / 季度报告),让他体验"拖入 → 提问 → 带来源回答"的完整闭环。
- 从 dashboard 空状态和首页均可进入;可 **cross-link 到 [web/chat.html](../web/chat.html)** 作为对话演示,让还没安装的人先看到"带来源回答"长什么样。该页在检测到本机模型栈时会由**真实本地模型**回答(优先带来源引用的项目知识库 RAG),检测不到则回退为预置演示,见 [docs/16 · 本地 AI 接入网页](16-local-ai-web-integration.md)。

**文案示例**

| 位置 | EN | 中 |
|------|----|----|
| 演示入口 | See it work in 60 seconds — with a sample document. | 用一份示例文档,60 秒看它怎么工作。 |
| 演示横幅 | You're in demo mode. Drop your own file anytime to make it yours. | 你正在演示模式。随时拖入你自己的文件,让它成为你的。 |

### 4.3 人话空状态与一键示例问题

- **每一个空状态都要回答两个问题**:这是什么?我现在该做什么(一个明确动作)?
- 禁止出现空白面板或纯图标;每个空状态配一句召唤 + 一个主动作按钮。

| 面板 | 空状态 EN | 空状态 中 |
|------|----------|----------|
| 知识库(📚) | No files yet. Drop a PDF, Word, or Excel to teach your AI. | 还没有文件。拖入 PDF、Word 或 Excel 来教你的 AI。 |
| 对话 | Ask me anything about your documents. Try a suggestion below. | 关于你的文档,尽管问我。试试下面的建议。 |
| Teach My AI(🎓) | Nothing to review yet. When you fix an answer, it shows up here. | 还没有可复习的内容。当你纠正一个回答,它会出现在这里。 |
| API(🔌) | Turn on the API to connect your own apps. | 打开 API,连接你自己的应用。 |

### 4.4 安装失败四大场景的人话恢复

安装是本地路径最大的技术漏点。对最常见的四类失败,给**人话原因 + 一键动作**,绝不暴露技术堆栈。

| 场景 | 内部原因 | 用户看到的 EN | 用户看到的 中 | 一键动作 |
|------|---------|--------------|--------------|----------|
| 磁盘空间不足 | 剩余空间 < 模型大小 | Not enough free space. You need about {X} GB. Free some up and retry. | 空间不够。大约还需要 {X} GB。清理一下再重试。 | [Retry / 重试] [Choose smaller model / 换更小的方案] |
| 显卡驱动过旧 | GPU driver outdated | Your graphics driver is a bit old. Update it, or run on CPU (slower). | 你的显卡驱动有点旧。更新一下,或用 CPU 运行(会慢些)。 | [How to update / 如何更新] [Run on CPU / 用 CPU] |
| 端口被占用 | 默认端口被占 | Something else is using our port. We'll switch to another one. | 有别的程序占用了端口。我们换一个。 | [Auto-fix / 自动切换] |
| 下载中断/网络 | 网络超时/校验失败 | The download got interrupted. We'll pick up where it left off. | 下载中断了。我们从断点继续。 | [Resume / 断点续传] [Retry / 重试] |

- 每个失败屏都带 **[Copy diagnostics / 复制诊断信息]**(见 §9.2),方便求助但不吓人。
- 失败也是埋点事件(见 §10),按 `error_type` 分类,反哺产品改进。

---

## 5 · 新手清单 / 进度(Onboarding Checklist)

在 Dashboard 常驻一个可折叠的 **Getting Started 清单**,把从"装好"到"用起来"的关键动作显性化,给用户明确的完成感与下一步。

### 5.1 清单项与文案

| 步骤 | EN | 中 | 完成判定 |
|------|----|----|----------|
| 1 | ✅ Your AI is installed | ✅ 你的 AI 已安装 | L2 装成 |
| 2 | ⬜ Add your first document | ⬜ 添加你的第一个文档 | 拖入 ≥1 文件并索引成功 |
| 3 | ⬜ Ask your first question | ⬜ 问出你的第一个问题 | 发送 ≥1 条消息 |
| 4 | ⬜ Get an answer with a source | ⬜ 得到一个带来源的回答 | **Aha(L3)** |
| 5 | ⬜ Fix one answer (Teach My AI) | ⬜ 纠正一次回答(喂 Teach My AI) | 提交 ≥1 条修正 |
| 6 | ⬜ Turn on the API | ⬜ 打开 API | API 首次开启 |

### 5.2 清单顶部/完成态文案

| 位置 | EN | 中 |
|------|----|----|
| 顶部进度 | You're {n}/6 set up. Finish to unlock your AI's full power. | 已完成 {n}/6。全部完成即可释放你 AI 的全部能力。 |
| 完成第 4 项(Aha) | 🎉 You just hit the big one — a private answer with a real source. | 🎉 你刚达成最关键的一步——一个带真实来源的私有回答。 |
| 全部完成 | All set. Your private AI is fully up and running. | 全部搞定。你的私有 AI 已完全就绪。 |

> 设计注意:清单**第 4 项(带来源回答)才是核心**,前 3 项是通往它的台阶;第 5、6 项是把用户推向留存(Teach My AI)和升级(API)的钩子。

---

## 6 · 留存机制(为什么会回来)

激活只是开始。要触发 North Star(**每周**得到有用回答),需要三条让用户"越用越离不开"的回路。

### 6.1 三条留存回路

| 回路 | 机制 | 为什么让人回来 | 可视化 |
|------|------|----------------|--------|
| A. 知识库复利 | 每拖一个文档,AI 能回答的问题范围就更大 | "它已经读了我 12 份文件,问什么都有依据" | 知识库文档数 + 覆盖主题标签 |
| B. Teach My AI 变准 | 每纠正一次,积累一条训练数据;够阈值自动 LoRA | "它在为我个人变得更准" | 进度条:已收集 X / 需要 Y 条 → 下一次自动升级 |
| C. 每周价值提醒 | 汇报"这周它帮你从资料里找到了什么" | 唤回 + 强化"它有用"的记忆 | 周报卡片 / 邮件 |

### 6.2 三条留存触发与文案

**触发 1 · Teach My AI 进度可视化(在 Dashboard 🎓)**

| 位置 | EN | 中 |
|------|----|----|
| 进度条 | Teach My AI: {X}/{Y} corrections collected. At {Y}, your AI upgrades itself — just for you. | Teach My AI:已收集 {X}/{Y} 条纠正。到 {Y} 条时,你的 AI 会为你自己升级一次。 |
| 临近阈值 | Almost there — {Z} more fixes and your AI gets noticeably sharper. | 就快了——再纠正 {Z} 次,你的 AI 会明显更准。 |

**触发 2 · 每周价值提醒(邮件,仅注册用户;Free 用应用内卡片)**

> Subject(EN):Your AI answered {N} questions from your files this week
> 主题(中):这周你的 AI 从你的资料里回答了 {N} 个问题

```
Hi {FirstName},

This week your private AI:
• Answered {N} questions — {M} of them with a source from your files
• Read {K} new pages you added
• Is {Z} corrections away from its next self-upgrade

Pick up where you left off → {DashboardLink}

Everything stays on your device. — Build My AI
```

中备:"这周你的私有 AI 回答了 {N} 个问题(其中 {M} 个带来自你文件的来源),读了你新增的 {K} 页,距离下一次自我升级还差 {Z} 次纠正。"

**触发 3 · 知识库复利提示(拖入第 N 个文档后)**

| 位置 | EN | 中 |
|------|----|----|
| 应用内 | Your AI now knows {N} documents. The more it reads, the better its answers. | 你的 AI 现在掌握了 {N} 份文档。它读得越多,答得越好。 |

> 留存原则:所有提醒都**报告用户自己的价值产出**(它帮我做了什么),而不是催促("你 3 天没来了")。前者强化价值,后者制造愧疚。

---

## 7 · 从 Free 到 Pro 的自然升级引导

升级引导的核心不是"什么时候弹窗",而是"**在用户已经想要那个能力的一刻**才提示"。Beta 期间**全部免费**,但 Pro/Business 功能需**注册解锁**——升级提示要如实这样说,降低戒心。

### 7.1 升级触发时机(意图信号驱动)

| 触发信号 | 用户此刻的想法 | 提示什么 | 落点 |
|----------|----------------|----------|------|
| 拖入第 N 个文档(如第 6 个) | "我资料越来越多了" | 更大知识库 / 更好检索(Pro) | 应用内软提示 |
| 点了"Fix this answer"若干次 | "我想让它真的记住我的纠正" | 自动微调 / LoRA(Pro) | Teach My AI 面板 |
| 打开 🔌 API 面板 | "我想接到自己的软件里" | API 访问(Pro) | API 面板顶部 |
| 想在第二台电脑用 | "我换台机器也要用" | 多设备(Pro) | 设置 / 设备页 |
| 团队/公司共享意图 | "想让同事一起用" | Business(公司知识库/权限) | 见 §8 |

### 7.2 升级提示文案(EN 主 / 中 备)

**软提示(应用内横幅,非阻断)**

| 场景 | EN | 中 |
|------|----|----|
| 微调意图 | Want your AI to truly learn your corrections? Auto fine-tuning is a Pro feature — free during Beta. | 想让你的 AI 真正学会你的纠正?自动微调是 Pro 功能——Beta 期间免费。 |
| API 意图 | Connect your own apps with the API. Pro feature, free in Beta — just create an account. | 用 API 连接你自己的应用。Pro 功能,Beta 期间免费——注册即可。 |
| 多设备 | Use your AI on another computer. That's Pro — free during Beta. | 在另一台电脑上使用你的 AI。这是 Pro——Beta 期间免费。 |

**升级弹窗(点击"解锁"后)**

```
Title (EN):  Unlock all features
标题 (中):    解锁全部功能

Body (EN):
You're using Build My AI Free. Unlock Pro to:
  • Auto fine-tuning (Teach My AI → real model upgrades)
  • API access for your own apps
  • Use on multiple devices
  • Larger knowledge base & priority answers

During Beta, all of this is FREE.
Just create a free account to unlock — no credit card.

[ Create free account ]        [ Maybe later ]

正文 (中):
你正在使用 Build My AI 免费版。解锁 Pro 可获得:
  • 自动微调(Teach My AI → 真正的模型升级)
  • API 访问,连接你自己的应用
  • 多设备使用
  • 更大的知识库与优先回答
Beta 期间,以上全部免费。注册免费账号即可解锁——无需信用卡。
[ 创建免费账号 ]        [ 以后再说 ]
```

> 落点:所有升级 CTA 指向 **[web/signup.html](../web/signup.html)**(注册页,已有 "Unlock all features" / "Create free account" / "You're on the beta list!" 文案)。Business 注册需**填写公司名**(见 §8)。

### 7.3 升级引导的禁忌

- **不要在 Aha 之前弹升级**:用户还没尝到价值就要账号,转化极差。
- **不要谎称"限时/涨价"**:Beta 免费就说免费,建立信任比制造紧迫更重要。
- **一次一个诉求**:根据触发信号只讲**当下最相关**的那个卖点,不要罗列全清单轰炸。

---

## 8 · Business / 团队引导

Business(从 $299/mo,Beta 免费)面向"想让整个团队/公司共用一个私有 AI"的用户。其引导与个人版有三点关键差异。

### 8.1 与个人版的差异

| 维度 | 个人(Free/Pro) | Business |
|------|-----------------|----------|
| 知识库 | 我的文档 | **公司知识库**:多人共同贡献、集中管理 |
| 权限 | 无 | **角色/权限**:谁能看、谁能加文档、谁能管模型 |
| 用户 | 单人 | **多用户**:邀请同事、席位管理 |
| 注册 | 邮箱即可 | **需填写公司名**(signup.html 的 Business 分支) |
| 引导重点 | "让它读我的资料" | "让团队共用一个可信、私有的公司大脑" |

### 8.2 Business 首次引导流程(在个人 FTUE 基础上增补)

1. **注册即建组织**:选择 Business → 填公司名 → 创建组织空间。
2. **建公司知识库**:引导管理员先拖入 3–5 份**公司级**核心文档(政策、合同模板、产品手册),奠定"共享大脑"基座。
3. **设权限角色**:至少区分 `Admin(管模型/权限)` 与 `Member(用 + 贡献文档)`。
4. **邀请同事**:发邀请链接;被邀请者的 FTUE 跳过"建库",直接进入"提问已有公司知识"。
5. **团队 Aha**:让第一位被邀请的同事在公司知识库里得到一个带来源回答——这是团队版的激活。

### 8.3 Business 文案示例

| 位置 | EN | 中 |
|------|----|----|
| 注册公司名 | Your company name (this names your shared AI workspace) | 你的公司名(用于命名你们的共享 AI 空间) |
| 建库引导 | Add a few company documents everyone should be able to ask about. | 先加几份大家都可能会问到的公司文档。 |
| 邀请 | Invite your team. They'll be answering from your company knowledge in minutes. | 邀请你的团队。几分钟内他们就能从公司知识里得到答案。 |
| 权限说明 | Admins manage the AI and who can access it. Members ask and add documents. | 管理员负责管理 AI 和访问权限。成员负责提问和添加文档。 |
| 被邀请者欢迎 | {Company}'s private AI is ready for you. Ask it anything about {Company}'s documents. | {公司}的私有 AI 已为你准备好。尽管问它关于{公司}文档的任何问题。 |

---

## 9 · 支持与自助

让用户在卡住时**不用等人工**就能自救,是引导体验的一部分。

### 9.1 人话 FAQ(8–10 条最可能的问题)

| # | 问题(EN / 中) | 答案要点 |
|---|----------------|----------|
| 1 | **Do I need to know anything technical?** / 我需要懂技术吗? | 不需要。只要回答几个大白话问题,拖入你的文件即可。全程无需命令行。 |
| 2 | **Is my data private? Does anything get uploaded?** / 我的数据私密吗?会上传吗? | 本地方案下,数据**永不离开你的设备**;云端方案会明确告知哪些数据在云端处理。默认私有优先。 |
| 3 | **Is it really free?** / 真的免费吗? | Free 版免注册永久可用;Pro/Business 在 **Beta 期间也全部免费**,只需注册解锁。 |
| 4 | **The install failed. What do I do?** / 安装失败了怎么办? | 每个失败都有人话原因和一键重试;常见为空间/驱动/端口/网络问题(见安装屏提示),或点"复制诊断信息"求助。 |
| 5 | **What files can it read?** / 它能读哪些文件? | PDF、Word、Excel、纯文本等常见文档,直接拖入即可。 |
| 6 | **Why doesn't the answer show a source?** / 为什么答案没有来源? | 若问题超出你已加的文档范围,它可能没法引用;多拖相关文档,或换个更贴近资料的问法。 |
| 7 | **How does it get smarter?** / 它怎么变聪明? | 你每纠正一次回答(Teach My AI),它就积累一条数据;够了会自动为你升级(微调)。 |
| 8 | **Can I use it without any documents?** / 没有文档也能用吗? | 可以,试试演示模式;但它的独特价值在于读**你自己的**资料。 |
| 9 | **Can my team use one shared AI?** / 团队能共用一个吗? | 可以,用 Business:公司知识库 + 权限 + 多用户,注册时填公司名。 |
| 10 | **My computer isn't powerful enough — now what?** / 我电脑不够强怎么办? | 我们会自动建议云端方案或更小的本地方案,你仍能得到带来源的答案。 |

### 9.2 "复制诊断信息"按钮

- 位置:安装失败屏、Dashboard 运行状态(💚)、设置页。
- 点击后复制一段**结构化但脱敏**的诊断文本(系统、方案、失败步骤、错误码、匿名 ID),用户可粘贴到社区/工单。
- 文案:`Copy diagnostics / 复制诊断信息`;复制后提示 `Copied — paste it when you ask for help. / 已复制——求助时粘贴它即可。`

### 9.3 社区与人工

| 渠道 | 用途 | 文案 |
|------|------|------|
| 社区论坛 | 同伴互助、常见问题 | Ask the community — chances are someone solved it. / 问问社区——多半有人遇到过。 |
| 帮助中心 | 图文教程、安装指南 | Step-by-step guides for every setup. / 每种方案都有分步骤图文指南。 |
| 邮件/工单(Pro/Business) | 一对一支持 | Priority support for Pro & Business. / Pro 与 Business 享优先支持。 |

---

## 10 · 引导相关的埋点(与 docs/13 对齐)

所有事件**匿名**采集(Free 亦然,仅匿名使用数据),口径与 [docs/13 §6 埋点方案](13-validation-testing-and-experiments.md) 统一。以下为**激活漏斗每一步**应上报的事件。

### 10.1 激活漏斗事件表

| 事件名 | 触发时机 | 关键属性 | 对应漏斗步 |
|--------|----------|----------|------------|
| `landing_view` | 打开 index.html | referrer, lang | L0 |
| `build_start` | 点击 Build My AI | source(hero/nav) | L1 |
| `wizard_need_submit` | 提交/选择需求 | need_category, typed(bool) | #3 |
| `wizard_hardware_detected` | 设备检测完成 | tier(fast/mid/cloud), detect_ok(bool) | #4 |
| `wizard_reco_view` | 展示推荐方案 | advanced_opened(bool) | #5 |
| `wizard_location_choose` | 选本地/云端 | location(local/cloud) | #6 |
| `wizard_generate` | 生成安装包/云手册 | location | #7 |
| `install_start` | 安装开始 | os, model_tier | #8 |
| `install_step` | 每个安装步骤 | step_name, duration | #8 |
| `install_fail` | 安装失败 | error_type(disk/driver/port/network), step | #8 |
| `install_success` | 安装成功 → L2 | total_duration | #8 / L2 |
| `dashboard_first_open` | 首次打开控制中心 | path(local/cloud) | #9 |
| `doc_added` | 文档索引成功 | file_type, count_total | #10 |
| `demo_mode_enter` | 进入演示模式 | from(landing/dashboard) | §4.2 |
| `first_message_sent` | 首次提问 | via_suggestion(bool) | #11 |
| `answer_with_source` | 回答带来源渲染 | source_count | #12 |
| **`activation`** | **拖 ≥1 文档 + 带来源回答(30min 内)** | time_to_activate | **L3(核心)** |
| `correction_submitted` | 提交一次 Teach My AI 修正 | corrections_total | §5/§6 |
| `teach_progress` | 达到微调阈值进度节点 | x_of_y | §6 |
| `api_enabled` | 首次开启 API | — | §5/§7 |
| `upgrade_prompt_view` | 展示升级提示 | trigger(docN/finetune/api/multidevice) | §7 |
| `upgrade_prompt_click` | 点击升级 CTA | trigger | §7 |
| `signup_complete` | 注册完成 | plan(pro/business), has_company(bool) | §7/§8 |
| `weekly_value_view` | 查看/打开周报 | channel(inapp/email) | §6 |

### 10.2 核心派生指标

| 指标 | 定义 | 目标方向 |
|------|------|----------|
| Activation Rate | `activation` / `build_start` | ↑ |
| Time-to-Activate | `activation.time_to_activate` 中位数 | ↓(目标 < 30min) |
| Install Success Rate | `install_success` / `install_start` | ↑ |
| 最大漏点 | 相邻两步转化率最低者 | 每周复盘 |
| Upgrade Intent | `upgrade_prompt_click` / `upgrade_prompt_view` | ↑ |
| North Star | 每周产生 ≥1 次 `answer_with_source`(有用)的活跃用户数 | ↑ |

> 埋点纪律:**不采集文档内容、不采集问题原文**,只采集类别/计数/时长等匿名信号;与 docs/13 的隐私口径完全一致。

---

## 附:引导设计的 10 条黄金准则

1. **Aha 优先于一切**:每个决策都问"这会让用户更快看到带来源的第一个答案吗?"
2. **注册墙永远在 Aha 之后**,不在之前。
3. **零技术名词**:质量/速度/占用,而非 VRAM/量化/Embedding。
4. **每一步有默认最优解**,用户可以全程只点"下一步"。
5. **失败可恢复、说人话、能一键重试**。
6. **没文档也能体验**(演示模式 + chat.html 演示)。
7. **空状态必须给下一步动作**,不留空白。
8. **留存靠"报告用户的价值产出",不靠催促**。
9. **升级按意图信号触发**,一次只讲一个最相关卖点;Beta 免费如实说。
10. **一切埋点匿名**,内容永不采集。

---

## 相关文档 · Cross-links

- [docs/02 · 产品概览](02-product-overview.md) —— 目标用户与完整用户旅程
- [docs/03 · 核心模块](03-core-modules.md) —— Advisor / Auto-Deploy / Control Center / RAG / Teach My AI / Registry
- [docs/13 · 测试、实验与假设验证](13-validation-testing-and-experiments.md) —— §6 埋点方案:事件字典与匿名口径(本文件的埋点以其为准)
- [docs/05 · 商业模式](05-business-model.md) —— Free / Pro / Business 定价与 Beta 免费策略
- 网站页面:
  - [web/index.html](../web/index.html) —— 营销首页 / 落地
  - [web/build.html](../web/build.html) —— 引导向导(需求→设备→推荐→本地/云端→生成)
  - [web/chat.html](../web/chat.html) —— 带来源引用的对话演示(可用作没文档用户的体验入口;检测到本机 llm-lab 时接入真实本地模型,否则回退预置演示,见 [docs/16](16-local-ai-web-integration.md))
  - [web/dashboard.html](../web/dashboard.html) —— 控制中心(空状态 + 新手清单 + 留存进度落点)
  - [web/signup.html](../web/signup.html) —— Pro/Business 注册(升级 CTA 落点;Business 填公司名)
