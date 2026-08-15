# 15 · Marketing Playbook —《Build My AI》多渠道广告与可直接使用的脚本库

> 本文是《Build My AI》最重要的落地文档。它不讲营销理论,而是给出**可直接复制发布的英文成稿**(广告文案、视频脚本、社区帖、邮件、搜索广告),每段英文成稿旁配中文讲解与使用说明。
>
> 面向市场:**美国(US market)**。所有对外文案一律使用美式英语。
>
> 使用约定:
> - 🇺🇸 **英文成稿区**:直接复制发布,只需替换 `[链接]`、`[日期]` 等占位符。
> - 🇨🇳 **中文说明区**:告诉你怎么用、为什么这么写、注意什么。
> - 所有数字(CAC、转化率、预算)均为**假设值**,标注 `(假设)`,上线后用真实数据替换。
>
> 交叉引用:商业计划与 GTM 见 [`docs/12-business-plan.md`](./12-business-plan.md)、定价与套餐见 [`docs/05-business-model.md`](./05-business-model.md);落地页与演示见 [`web/`](../web/)(`index.html` / `build.html` / `chat.html` / `dashboard.html` / `signup.html`)。

---

## 目录

1. [定位与信息层级](#1-定位与信息层级)
2. [目标受众与渠道选择](#2-目标受众与渠道选择)
3. [内容与教程计划(Tutorial-Led Growth)](#3-内容与教程计划tutorial-led-growth)
4. [广告创意 + 完整脚本(核心章节)](#4-广告创意--完整脚本核心章节)
5. [SEO / 关键词地图](#5-seo--关键词地图)
6. [发布日历(30 / 60 / 90 天)](#6-发布日历30--60--90-天)
7. [衡量与预算](#7-衡量与预算)
8. [品牌与合规注意](#8-品牌与合规注意)

---

## 1. 定位与信息层级

### 1.1 一句话定位(Positioning Statement)

🇺🇸 **英文成稿**

> **Build My AI turns the complex, open-source AI world into a personal AI that anyone can own in one click — running privately on your own computer, so your files never leave your machine.**

🇨🇳 **中文说明**
这是所有文案的"母版"。任何标题、广告、帖子都是这句话的裁剪版。三个不可丢的支点:**complex → simple(一键)**、**private / on your own computer(隐私本地)**、**anyone can own(非技术用户)**。写任何新文案前,先问:它有没有踩中这三点中的至少一个?

### 1.2 三条核心 Message

| # | Core Message(英文) | 中文含义 | 主要打给谁 |
|---|---------------------|---------|-----------|
| M1 | **Your data never leaves your computer.** | 本地优先 = 隐私。数据不上云、不喂给大厂。 | 隐私党、律师、医生、财务 |
| M2 | **No models, GPUs, RAG, or Docker to learn — just describe what you need.** | 零术语。你不需要懂 AI,只需要说人话。 | 非技术 SMB、专业人士 |
| M3 | **Own your first private AI in about 20 minutes — free to start.** | 20 分钟拥有、免费开始、低门槛。 | 所有人(降低尝试成本) |

🇨🇳 **说明**:每条广告最多主打**一条** message。混着讲会稀释。短视频 3 版就是分别对应 M1 / M2 / M3。

### 1.3 可直接使用的 Taglines / Headlines(英文,5+ 条)

🇺🇸 **英文成稿(可直接用于网站 hero、广告标题、社媒 bio)**

1. **Your own private AI. In one click.**
2. **The AI that reads your files — and keeps them yours.**
3. **ChatGPT-style answers, on your computer, from your documents.**
4. **No code. No cloud. Just your own AI.**
5. **Turn your PDFs, Word, and Excel files into an AI you actually own.**
6. **Private AI for people who aren't programmers.**
7. **Stop renting AI. Own it.**

🇨🇳 **说明**
- 第 1、6 条最适合做**主 hero 标题**(index.html)。
- 第 3 条适合搜索广告(包含 "ChatGPT" 类比,但注意合规:见 §8,不要暗示官方关联)。
- 第 7 条("Stop renting AI. Own it.")情绪最强,适合短视频结尾和 X 推文,但**避免在同一素材里对订阅服务点名攻击**。

### 1.4 分受众价值主张(Value Props by Audience)

| 受众 | 他们的痛点(中文) | 🇺🇸 One-line value prop(英文成稿) |
|------|------------------|-----------------------------------|
| **SMB / 小企业主** | 想用 AI 但怕数据泄露、请不起工程师、不想学工具 | *"Give your business a private AI assistant that reads your contracts, SOPs, and spreadsheets — set up in an afternoon, no IT team needed."* |
| **专业人士**(律师/会计/顾问) | 客户资料高度敏感,合规上传不了云端 AI | *"Ask questions across your case files and get answers with citations — without a single document leaving your office."* |
| **研究者 / 学者** | 大量 PDF 文献,需要可溯源、可复现 | *"Chat with your entire research library and see exactly which paper each answer came from."* |
| **隐私党 / 技术爱好者** | 不信任云端 AI,想本地跑开源模型但嫌配置麻烦 | *"Local, open-source LLMs — without the Docker, CUDA, and config hell. One installer, runs offline."* |

🇨🇳 **说明**:落地页可以做**受众分流入口**(4 个卡片),点进去分别对应上面 4 句 value prop 的着陆页变体。UTM 里用 `?aud=smb / pro / research / privacy` 区分。

---

## 2. 目标受众与渠道选择

### 2.1 为什么是这批受众 × 这些渠道

🇨🇳 我们的核心用户画像是:**拥有一台 Windows + NVIDIA PC、对隐私敏感、但不是程序员**的美国人。这决定了渠道选择的三条逻辑:

1. **他们已经有硬件** → 说明是游戏玩家、创作者、专业人士或小企业主,活跃在 YouTube、Reddit、X。
2. **隐私敏感** → 对"本地/不上云"叙事天然共鸣,Reddit 的 r/privacy、r/LocalLLaMA、r/selfhosted 是高浓度人群。
3. **非技术** → 需要**教程带动**(看着别人做一遍就敢自己做),所以 YouTube 长视频 + 博客教程是主引擎,而非纯品牌广告。

### 2.2 渠道优先级表

| 优先级 | 渠道 | 角色 | 为什么适合 | 前期投入 |
|-------|------|------|-----------|---------|
| P0 | **YouTube(长视频教程)** | 主转化引擎 | 非技术用户靠"看别人做一遍"建立信心;SEO 长尾 | 高(制作) |
| P0 | **Reddit**(r/LocalLLaMA, r/privacy, r/selfhosted, r/smallbusiness) | 冷启动 + 信任 | 高浓度目标人群;真诚 Show 帖转化质量高 | 低(时间) |
| P0 | **SEO 博客教程** | 长期自然流量 | "how to run local LLM"类关键词持续有量 | 中 |
| P1 | **Product Hunt / Hacker News** | 发布日爆发 | 一次性获取早期用户 + 反向链接 + 信誉 | 中(集中) |
| P1 | **短视频**(TikTok / Reels / Shorts) | 顶部拉新 | 隐私恐惧 hook 传播性强 | 中 |
| P1 | **X / Twitter** | 社区 + 开发者关系 | build-in-public,聚集 AI/隐私圈 | 低 |
| P2 | **Google Search Ads** | 承接高意图搜索 | "chat with PDF privately"等意图明确 | 中(付费) |
| P2 | **Email 序列** | 激活与升级 | Free→Pro 转化主渠道 | 低 |
| P2 | **LinkedIn** | 触达 SMB / 专业人士 | B2B 语境,Business 计划线索 | 低 |

🇨🇳 **说明**:Beta 期先把 P0 做扎实(免费流量 + 信任),Product Hunt/HN 做发布日(P1),付费(P2 Google Ads)等定位验证、落地页转化率跑通后再放量,避免烧钱买不转化的流量。

---

## 3. 内容与教程计划(Tutorial-Led Growth)

🇨🇳 核心策略:**教程即广告**。每篇教程独立解决一个真实问题,自然带出产品。以下 10 个选题按"意图 + 关键词"排序,可直接进内容排期。

| # | 教程标题(英文成稿) | 目标关键词 | 格式 | 🇺🇸 Hook(一句话) |
|---|---------------------|-----------|------|-------------------|
| 1 | **How to Build a Private AI That Reads Your Company PDFs in 20 Minutes** | private ai for documents | Blog + YouTube | *"Your company's files are too sensitive for ChatGPT. Here's how to build an AI that never sends them anywhere."* |
| 2 | **Run a Local LLM on Windows With an NVIDIA GPU — No Command Line** | run local llm windows | Blog + YouTube | *"Everyone says local AI needs Docker and CUDA. It doesn't. Watch."* |
| 3 | **Chat With Your PDFs Offline: A No-Code Guide** | chat with pdf offline | Blog + Short | *"No internet. No account. Just you and your documents."* |
| 4 | **ChatGPT vs. Your Own Private AI: What's the Real Difference?** | private ai vs chatgpt | Blog + YouTube | *"One rents you intelligence. The other you own. Here's the honest comparison."* |
| 5 | **How Lawyers Can Use AI Without Breaking Client Confidentiality** | ai for lawyers privacy | Blog + LinkedIn | *"The reason your firm banned ChatGPT — and the setup that solves it."* |
| 6 | **Turn 100 Research Papers Into a Searchable AI (With Citations)** | ai literature review tool | Blog + YouTube | *"Ask a question, get an answer, and see exactly which paper it came from."* |
| 7 | **The Cost of AI Subscriptions vs. Running Your Own (2026 Math)** | ai subscription cost | Blog + Short | *"$20/mo × 5 tools × forever. Or a one-time free setup. Let's do the math."* |
| 8 | **Which Open-Source AI Model Should You Actually Run? (Beginner's Guide)** | best open source llm | Blog | *"Llama, Mistral, Qwen… you don't need to choose. Here's how the choice gets made for you."* |
| 9 | **Give Your Small Business a Private AI Assistant This Weekend** | ai assistant small business | Blog + YouTube | *"No IT team. No monthly per-seat fee. One afternoon."* |
| 10 | **Teach Your AI: How to Make a Local Assistant Smarter Over Time** | improve local ai answers | Blog + Short | *"Your AI got something wrong? Correct it once — it remembers."* |

🇨🇳 **说明**
- 选题 1、2、9 是**主力**(覆盖 SMB + 非技术 + Windows/NVIDIA,直接对应 MVP)。
- 每篇博客结尾统一 CTA:*"Ready to build yours? Start free — no signup needed → [build.html 链接]"*。
- YouTube 视频的完整脚本见 §4.a(以选题 1/2 合并为拍摄脚本)。

---

## 4. 广告创意 + 完整脚本(核心章节)

> 🇨🇳 以下全部为**可直接复制发布的英文成稿**。占位符仅有 `[URL]`、`[date]`、`[your name]` 等。语气要求:真实、可信、像一个真的做出东西的人在分享,而不是营销号。避免 AI slop 词汇(如 "revolutionize"、"game-changer"、"seamless"、"unlock the power of")。

---

### 4.a YouTube 长视频教程脚本(8–12 分钟)

**视频标题(英文成稿):** `Build Your Own Private ChatGPT That Reads Your Files — No Coding`

**缩略图文字建议:** `PRIVATE AI` + `NO CODE` + 一个红叉划掉的 cloud 图标。

🇨🇳 **说明**:这是主转化视频。结构 = 痛点(30s)→ 承诺 →实操录屏(主体)→ 结果验证 → CTA。下面给**口播全文 + 画面/录屏提示**。口播可直接照读。

---

#### 分镜脚本(Shot List + Voiceover)

**[0:00–0:30] 冷开场 / 痛点(镜头:主播出镜或屏幕)**

🇺🇸 Voiceover:
> "If you've ever wanted to use AI on your own documents — contracts, medical records, research, financial statements — but you didn't want to upload them to some company's servers, this video is for you. In the next ten minutes, I'm going to build a private AI, running entirely on this computer, that can read my files and answer questions about them — with citations. No coding. No cloud. And I've never done this on this machine before, so you're seeing it for real."

📺 画面:主播说话 → 切到一堆敏感文件的 B-roll(合同、PDF)→ 切到 ChatGPT 上传框上打一个红叉。

---

**[0:30–1:15] 承诺与前提(镜头:屏幕 + 画中画)**

🇺🇸 Voiceover:
> "Here's the honest setup. This runs best on a Windows PC with an NVIDIA graphics card — the kind a lot of us already have for gaming or work. Everything I do here is free to start. And the whole point is: your data never leaves your computer. Let me show you the tool I'm using — it's called Build My AI. Its job is to take the whole messy world of open-source AI and turn it into something you can just… click. Let's go."

📺 画面:展示 index.html 首页;鼠标悬停在 "Start free" 按钮上。

---

**[1:15–3:00] 步骤 1 — 描述需求 + 检测电脑(屏幕录制)**

🇺🇸 Voiceover:
> "First step — and this is the part I love — it just asks me what I want to do in plain English. So I'll type: 'I want an AI that can read my PDFs and answer questions about them.' That's it. No picking a model. No jargon. Now it's checking my computer — it sees my graphics card, my memory — and based on that, it recommends the best AI model my machine can actually run well. I'm not choosing between Llama and Mistral and a dozen names I don't understand. It chose for me. I just click 'Recommended.'"

📺 录屏:build.html 向导 → 输入框打字 → PC detection 动画(显示 GPU/RAM)→ 推荐模型卡片高亮 → 点击。

🇨🇳 **录制提示**:这一段是"零术语"卖点(M2)的证明段落,一定要**真实录屏**,让观众看到它自动帮你做选择。

---

**[3:00–5:00] 步骤 2 — 一键安装(屏幕录制)**

🇺🇸 Voiceover:
> "Now it gives me a one-click installer. I download it, I run it — and while that's going, notice what I'm *not* doing. I'm not opening a terminal. I'm not installing Docker or CUDA or Python. I'm not editing a config file. It's just an installer, like any other app. Give it a couple of minutes… and there it is. My own AI is now running, locally, on this computer. If I turned off my Wi-Fi right now, it would still work. Let me actually do that — see, still running."

📺 录屏:下载安装包 → 运行 → 进度条 → 断开 Wi-Fi(展示 offline)→ 本地 chat 界面打开。

🇨🇳 **录制提示**:**断网演示**是本视频最有说服力的 15 秒,务必保留。这是 M1(本地/隐私)最硬的证据。

---

**[5:00–8:00] 步骤 3 — 拖入文件 + 带引用问答(屏幕录制)**

🇺🇸 Voiceover:
> "Okay, the fun part. I'm going to drag in a few files — here's a 40-page PDF contract, a Word doc, and an Excel sheet. It's reading them now, indexing them privately on my machine. Now I ask it a real question: 'What's the termination notice period in this contract, and are there any penalties?' … And look at that. It gives me the answer — 60 days' notice, a penalty clause in section 9 — and here's the important part: it shows me the source. It's citing the exact page. So I'm not just trusting a black box; I can click through and verify it myself. That's the difference between a chatbot and a research tool."

📺 录屏:拖拽 3 个文件 → indexing 提示 → chat.html 提问 → 回答出现 → **高亮 citation 来源链接** → 点开跳到 PDF 对应页。

🇨🇳 **说明**:引用(citations)是差异化核心,画面上一定要**放大展示来源标注**。

---

**[8:00–9:30] 步骤 4 — Teach My AI(屏幕录制)**

🇺🇸 Voiceover:
> "One more thing. Say it gets something slightly wrong, or you want it to answer in a certain way. There's a 'Teach My AI' option — you correct it once, and it remembers for next time. So the more you use it, the more it fits how *you* work. It's yours, and it gets better with you."

📺 录屏:dashboard.html → Teach My AI → 输入一条纠正 → 再问同样问题看到改进。

---

**[9:30–10:30] 结果回顾 + 诚实边界**

🇺🇸 Voiceover:
> "So let's recap what just happened. In about twenty minutes, on a normal Windows PC, I built a private AI that reads my documents, answers with citations, works offline, and gets smarter as I use it — and I never wrote a line of code. Now, to be straight with you: a giant cloud model might still be a bit smarter on some general questions. But for working with your own private files, on your own hardware, without sending anything to anyone? This is a genuinely great trade. And for a lot of us, privacy isn't optional."

🇨🇳 **说明**:这段**主动承认局限**(云端大模型在通用任务上可能更强),反而提升可信度,符合 §8 诚实营销。不要删。

---

**[10:30–11:00] CTA**

🇺🇸 Voiceover:
> "If you want to build your own, it's free to start — no signup, nothing to lose. I'll put the link in the description. If this was useful, subscribe, because I'm going to do more of these — building private AI for specific jobs like legal, research, and small business. Thanks for watching."

📺 画面:build.html 链接卡片 + 订阅按钮动画。

**视频描述(英文成稿,可直接粘贴):**
> In this video I build a private AI on a normal Windows PC that reads my own files and answers with citations — no coding, no cloud, and it works offline. Tool used: Build My AI (free to start, no signup): [URL]
>
> Chapters:
> 0:00 The problem with uploading your files to AI
> 1:15 What Build My AI does
> 1:15 Step 1 — Describe what you need + detect your PC
> 3:00 Step 2 — One-click install (no Docker/CUDA)
> 5:00 Step 3 — Drag in your files + ask with citations
> 8:00 Step 4 — Teach it to get better
> 9:30 Honest limits + when to use this
>
> Your data never leaves your computer.

---

### 4.b 短视频脚本 ×3(TikTok / Reels / YouTube Shorts,30–45 秒)

🇨🇳 **通用说明**:竖屏 9:16,前 2 秒必须抓住,全程配 on-screen text(很多人静音看)。每条对应一条核心 message。

---

#### 短视频 #1 — Hook:隐私恐惧(对应 M1)

| 时间 | 🇺🇸 口播/字幕(Voiceover) | 📺 画面提示 | On-screen text |
|------|--------------------------|------------|----------------|
| 0–3s | "Every time you paste something into ChatGPT, ask yourself: where does it go?" | 手打字粘贴合同到聊天框,画面变红 | "WHERE DOES IT GO?" |
| 3–10s | "Your contracts. Your medical records. Your clients' data. It leaves your computer — and you don't get it back." | 文件"飞"进 cloud 图标 | "IT LEAVES YOUR COMPUTER" |
| 10–25s | "So I built mine differently. This AI runs on my own PC. I drag in my files, ask questions, get answers with sources — and I can literally turn off my Wi-Fi." | 录屏:本地问答 + 断网仍工作 | "OFFLINE. STILL WORKS." |
| 25–35s | "Your data never leaves your computer. No coding. Free to start." | 展示 build 界面 | "PRIVATE AI · NO CODE" |
| 35–40s | "Link in bio. Build your own." | CTA 卡片 | "→ Build My AI" |

🇺🇸 **Caption(英文成稿):**
> I stopped uploading my private files to AI. Built my own instead — runs on my PC, works offline, answers with citations. No coding. Free to start. 🔒

🇺🇸 **Hashtags:** `#privacy #localai #privateai #ai #chatgptalternative #datasecurity #nocode #techtok`

---

#### 短视频 #2 — Hook:"我不是程序员也能做"(对应 M2)

| 时间 | 🇺🇸 口播/字幕 | 📺 画面提示 | On-screen text |
|------|--------------|------------|----------------|
| 0–3s | "I'm not a programmer. I built my own AI in 20 minutes. Here's the whole thing." | 主播摊手笑 | "NOT A PROGRAMMER" |
| 3–12s | "No Docker. No Python. No command line. I just typed what I wanted — in English." | 录屏:向导输入需求 | "I JUST TYPED WHAT I WANTED" |
| 12–22s | "It checked my computer, picked the right AI for me, and gave me one installer. I clicked it." | 录屏:PC 检测 + 一键安装 | "ONE CLICK" |
| 22–35s | "Now it reads my files and answers questions — with sources. On my own computer." | 录屏:拖文件 + 带引用问答 | "READS MY FILES" |
| 35–42s | "If I can do it, you can. Free to start — link in bio." | CTA | "→ Build My AI" |

🇺🇸 **Caption:**
> POV: you're not technical but you just built a private AI that reads your documents. No code, no cloud, ~20 minutes. Free to start.

🇺🇸 **Hashtags:** `#nocode #ai #privateai #localllm #productivity #smallbusiness #techtok #learnontiktok`

---

#### 短视频 #3 — Hook:"省钱,不用一堆 AI 订阅"(对应 M3 + 成本)

| 时间 | 🇺🇸 口播/字幕 | 📺 画面提示 | On-screen text |
|------|--------------|------------|----------------|
| 0–3s | "Add up what you pay for AI every month. I'll wait." | 屏幕列出多个订阅账单 | "$20 + $20 + $20…" |
| 3–12s | "Most of us are renting AI we don't even own. Every month. Forever." | 日历翻页 + 扣款动画 | "RENTING. FOREVER." |
| 12–25s | "So I set up my own — it runs on the PC I already have. Reads my files, answers with sources, works offline." | 录屏:本地 AI 工作 | "RUNS ON MY OWN PC" |
| 25–35s | "It's free to start. Not a trial — actually free. You only pay if you want the Pro extras." | 展示 pricing(Free 高亮) | "FREE TO START" |
| 35–42s | "Stop renting AI. Own it. Link in bio." | CTA | "→ Build My AI" |

🇺🇸 **Caption:**
> The math on AI subscriptions isn't mathing. I built my own private AI on the PC I already own — free to start, works offline, reads my files. 💸

🇺🇸 **Hashtags:** `#savemoney #ai #subscriptions #privateai #localai #frugal #techtok #productivity`

🇨🇳 **合规提示**:短视频 #3 强调"免费"时,措辞已用 *"free to start / actually free"* 且点明 Pro 才付费,符合真实(Beta 期全免费)。**不要**说"forever free / never pay"。

---

### 4.c Reddit 帖子 ×2

🇨🇳 **通用说明**:Reddit 极度反感硬广。规则:(1) 先给价值/真诚故事,产品自然带出;(2) 标注自己是 maker(社区看重透明);(3) 不要在标题塞产品名做标题党;(4) 发帖前读该 sub 的自我推广规则。

---

#### 帖子 #1 — r/LocalLLaMA(技术向 "Show" 帖)

🇺🇸 **标题:**
> Show: a one-click local LLM installer for non-technical people (Windows + NVIDIA, RAG over your own docs, fully offline)

🇺🇸 **正文(英文成稿):**
> I've spent the last few months watching non-technical friends and family bounce off local LLMs. They *want* privacy and their own docs indexed, but "install Docker, set up CUDA, pick a quant, configure a vector DB" is a wall they never get over. So I built something to remove that wall, and I'd genuinely like this community's scrutiny.
>
> **What it does:** you describe what you want in plain English → it detects your hardware (GPU/VRAM/RAM) → recommends a model that'll actually run well on your machine → gives you a single installer (no terminal) → you drag in PDF/Word/Excel for RAG → chat with source citations → a "Teach My AI" loop to correct/steer it over time. Everything runs locally; nothing is sent out. Windows + NVIDIA is the current target (that's where the MVP is solid).
>
> **What I'm *not* claiming:** it's not going to beat a frontier cloud model on general reasoning. The pitch is narrow and honest — private, local, on files you own, with zero setup friction, for people who will never touch a command line.
>
> **Under the hood** (happy to go deeper in comments): it's orchestrating existing open-source inference + a local vector store, with hardware-based model routing so the user never has to know what a quant is. The value I'm adding is the packaging and the routing decisions, not reinventing inference.
>
> Honest questions for you all:
> 1. For the "recommend a model for this exact GPU" routing, what heuristics would you trust vs. find naive?
> 2. Where does local RAG most often disappoint non-technical users, in your experience?
> 3. Any licensing gotchas I should be extra careful about when bundling open models for redistribution?
>
> It's free to start (no signup). I'll drop the link in a comment to respect the self-promo rules — mods, remove if not okay. Not looking to spam; genuinely want feedback from people who know this stuff cold.

🇨🇳 **说明**:这个 sub 是硬核用户,**技术透明 + 主动示弱 + 提真问题**是通行证。把链接放评论区(遵守规则),正文不塞链接。

🇺🇸 **评论区回复模板:**

- 被质疑"这不就是套壳 Ollama/LM Studio 吗":
  > Fair question. Under the hood it does lean on existing open-source inference — I'm not pretending to reinvent that. The difference is who it's for: LM Studio/Ollama still assume you'll pick a model and understand quants. This is for the person who doesn't know those words and never will. The routing ("given *this* GPU, run *this* model at *this* setting") and the one-installer packaging are the actual work. If that's not novel enough to be interesting to you, totally fair.

- 有人要技术细节:
  > Sure — [具体回答:vector store 选型、routing 逻辑、支持的模型]. Anything specific you want me to expand on? Happy to.

- 有人抱怨"又一个 Windows-only 工具":
  > Yep, and I get the frustration. Windows + NVIDIA is just where I could make the experience actually reliable first. Linux and Apple Silicon are on the roadmap — I didn't want to ship a mediocre version everywhere before one solid version somewhere.

---

#### 帖子 #2 — r/privacy(问题解决向)

🇺🇸 **标题:**
> How I finally use AI on my sensitive documents without sending them to anyone's servers

🇺🇸 **正文(英文成稿):**
> Like a lot of people here, I hit a wall with AI tools: they're useful, but I'm not about to paste contracts, health records, or client files into a service that logs everything and trains on who-knows-what. The "we don't train on your data, trust us" toggle isn't good enough for some of the stuff I deal with.
>
> The actual fix, it turns out, is to run the AI locally — on your own machine, so nothing leaves it. The catch has always been that doing that yourself is a nightmare of Docker, drivers, and config unless you're technical.
>
> I ended up using a tool (full disclosure: I'm involved in building it, so take this with the appropriate salt) that packages the whole thing into one installer for Windows + NVIDIA machines. You drag in your PDFs/Word/Excel, and it answers questions about them with citations, entirely offline — you can pull your network cable and it keeps working. Your files get indexed locally and never get uploaded.
>
> Sharing mostly because "just run it locally" is advice this sub gives constantly, and I wanted to point out the setup barrier is finally getting low enough for non-technical folks. Happy to answer questions about the privacy model, what's stored where, and the honest limits (a local model won't match a frontier cloud model on general tasks — but for private docs, the tradeoff is worth it to me).
>
> I'll keep the link out of the post body per the rules; mods, let me know if even mentioning the category is over the line.

🇺🇸 **评论区回复模板:**
- "开源吗 / 能审计吗":
  > The orchestration layer isn't fully open yet, but it runs open-source models locally and I'm happy to be specific about what data is stored where (short version: your documents and their index stay on your disk; the only thing that leaves is anonymous usage stats, and that's off if you want). If verifiability matters to you, that's a fair bar and I won't oversell it.

🇨🇳 **说明**:r/privacy 对"信任我"的话术免疫,所以正文里**主动 disclose 自己是 maker**、**主动说局限**、**主动交代数据存哪**。这不是弱点,是这个社区唯一能被接受的姿态。

---

### 4.d Hacker News — "Show HN"

🇺🇸 **标题(英文成稿):**
> Show HN: Build My AI – one-click local LLM with RAG for non-technical people

🇺🇸 **正文(英文成稿):**
> Hi HN. Build My AI turns the messy open-source local-LLM stack into something a non-technical person can set up in one click.
>
> The flow: you describe what you want in plain English → it detects your hardware → recommends a model that runs well on it → gives you a single installer (no terminal, no Docker, no CUDA setup) → you drag in PDF/Word/Excel for RAG → you chat with source citations → a "Teach My AI" loop lets you correct and steer it over time. Everything runs locally; documents never leave the machine. MVP targets Windows + NVIDIA.
>
> Why I built it: I kept watching non-technical people who genuinely need private AI (lawyers, clinicians, small-business owners) give up during setup. The frontier of local LLMs is amazing and almost none of them can reach it. The hard part isn't inference — that's solved by great open-source projects — it's the packaging, the hardware-aware model routing, and hiding every piece of jargon.
>
> What it's not: it won't beat GPT-class cloud models on general reasoning. The bet is that "private, local, over your own files, zero setup" is worth more than raw benchmark scores to a large group of people who are currently locked out.
>
> It's free to start with no signup (anonymous usage data only). Pro is $29/mo, Business from $299/mo; everything's free during the beta.
>
> I'd love feedback on two things specifically: (1) the honesty of the hardware→model routing, and (2) whether the "no jargon at all" approach holds up or hides too much. Link: [URL]

🇨🇳 **说明**:HN 读者是工程师,吃"技术诚实 + 承认局限 + 明确定价"。**不要**用营销词。把定价直接写清是 HN 的加分项(透明)。发帖时间选美西周二/周三上午。

---

### 4.e Product Hunt 发布文案

🇺🇸 **Tagline(≤60 字符):**
> Your own private AI, in one click. No code, no cloud.

🇺🇸 **Description(英文成稿):**
> Build My AI turns the complex world of open-source AI into a personal AI anyone can own — running privately on your own computer. Describe what you need in plain English, and it detects your PC, recommends the best model for it, and installs it in one click. Drag in your PDFs, Word docs, and spreadsheets, then chat with answers that cite their sources. No models, GPUs, RAG, or Docker to learn. Your data never leaves your machine. Free to start, no signup. (MVP: Windows + NVIDIA.)

🇺🇸 **Maker Comment(第一人称,英文成稿):**
> Hey Product Hunt 👋 I'm [your name], and I built Build My AI because I was tired of watching non-technical people who *really* need private AI — lawyers, doctors, small-business owners, researchers — give up the moment they hit "install Docker."
>
> The open-source local-AI world is incredible and almost nobody outside of engineers can actually use it. So the whole product is one idea: take that complexity and hide it completely behind one click. You describe what you want, it figures out your hardware, picks the right model, installs it, and lets you drag in your own files and chat with citations — all locally, so your data never leaves your computer.
>
> I want to be honest about the tradeoff: a local model won't out-reason a frontier cloud model on general questions. But for working privately with your own documents, on hardware you already own, I think it's a genuinely great deal — and for a lot of people, privacy isn't negotiable.
>
> It's free to start (no signup needed), and everything's free during the beta. I'd love your honest feedback, especially on where the "no jargon" approach helps vs. where it hides too much. I'm here all day. 🙏

🇺🇸 **First Comment(可置顶,引导讨论):**
> One thing I'd genuinely love input on: we made the deliberate choice to *never* show you model names, quant settings, or GPU details — the app just picks for you. Some power users hate that. Do you want an optional "advanced mode," or does surfacing any of that break the whole promise? Curious what this crowd thinks.

🇨🇳 **说明**:PH 文化 = maker 亲自在场、真诚、请求反馈。发布日 12:01 AM PT 上线,全天回复每条评论。Tagline 卡 60 字符以内。

---

### 4.f X / Twitter

#### 5 条独立推文(英文成稿,可分散发)

🇺🇸 **Tweet 1(隐私):**
> You wouldn't hand a stranger your contracts, medical records, and client files.
>
> But that's basically what happens every time you paste them into a cloud AI.
>
> I built an AI that reads all of that — and never lets it leave my computer. 🔒

🇺🇸 **Tweet 2(非技术):**
> "Running a local AI" used to mean Docker, CUDA, quantization, and a weekend gone.
>
> Now it means: type what you want → click install → drag in your files.
>
> No terminal. No jargon. ~20 minutes.

🇺🇸 **Tweet 3(引用/可信):**
> The feature that changed how much I trust AI:
>
> every answer shows me the exact source in my own documents.
>
> Not "the AI said so." → "page 9 of this contract said so." I can click and verify.

🇺🇸 **Tweet 4(成本):**
> AI subscriptions are the new cable bill.
>
> $20 here, $20 there, every month, forever, for tools you never actually own.
>
> I set mine up once on the PC I already had. Free to start. Runs offline.

🇺🇸 **Tweet 5(offline 演示,配视频):**
> Best part of running AI locally:
>
> I can pull the network cable and it still works. Still reads my files. Still answers.
>
> Your data can't leak if it never leaves. 👇 [attach 断网演示 clip]

---

#### Launch Thread(6–8 推,英文成稿)

🇺🇸
> **1/** Today I'm launching Build My AI: your own private AI, set up in one click, running on your own computer. No code. No cloud. Here's what it does and why I built it 🧵
>
> **2/** The problem: the open-source local-AI world is genuinely amazing. And almost nobody outside of engineers can use it. "Install Docker, pick a model, configure a vector DB" is where normal people give up — the exact people who need privacy most.
>
> **3/** So the whole product is one idea: hide *all* of that behind one click. You describe what you want in plain English. It detects your PC. It picks the model that'll run well on your hardware. It installs it. You never see a single piece of jargon.
>
> **4/** Then you drag in your PDFs, Word docs, and spreadsheets. It indexes them — locally. You ask questions and get answers that cite the exact source. Not "trust me," but "here's the page it came from," which you can click and verify.
>
> **5/** Everything runs on your machine. Pull your network cable and it keeps working. Your files never get uploaded, never train anyone's model, never leave. For lawyers, clinicians, small businesses, researchers — that's not a nice-to-have, it's the whole ballgame.
>
> **6/** Being honest about the tradeoff: a local model won't out-reason a frontier cloud model on general questions. But for private work on your own files, on hardware you already own? I'll take it every time. And so will a lot of people who simply can't use cloud AI at all.
>
> **7/** It's free to start — no signup — and free during the beta. Windows + NVIDIA for now (where it's rock solid); more coming.
>
> **8/** If you've ever wanted AI on your own documents but not at the cost of your privacy, try it and tell me what breaks: [URL] 🙏 RTs genuinely help a solo-ish launch.

🇨🇳 **说明**:thread 首推是钩子,末推给链接 + 请求 RT。第 6 推的"承认局限"是 X 上建立可信度的关键,别删。

---

### 4.g Google Search Ads(3 组)

🇨🇳 **说明**:RSA(响应式搜索广告)。Headline ≤30 字符、Description ≤90 字符(下面每条已控制字数,发布前用字符计数器复核)。三组对应三种意图,各配独立着陆页(见 §5 关键词地图)。

---

#### Ad Group 1 — 意图:Private AI(隐私通用)

🇺🇸 **Headlines(≤30 chars,每条已数):**
1. `Your Own Private AI` (19)
2. `AI That Keeps Files Private` (27)
3. `No Cloud. No Code. Just AI.` (27)
4. `Private AI On Your PC` (21)
5. `Data Never Leaves Your PC` (25)

🇺🇸 **Descriptions(≤90 chars):**
1. `Build a private AI that reads your files and works offline. Free to start, no signup.` (85)
2. `No Docker, no coding. One click. Your documents stay on your own computer.` (74)
3. `Answers with citations from your own PDFs, Word & Excel. Windows + NVIDIA.` (73)

🇺🇸 **Keywords:** `private ai`, `private ai assistant`, `local ai app`, `offline ai`, `ai that keeps data private`, `secure ai for documents`, `[exact] "private chatgpt alternative"`

---

#### Ad Group 2 — 意图:Local LLM(技术向搜索)

🇺🇸 **Headlines(≤30 chars):**
1. `Run a Local LLM, No Setup` (25)
2. `Local LLM Without Docker` (24)
3. `One-Click Local AI Model` (24)
4. `Local LLM for Windows` (21)
5. `Best Local LLM, Auto-Picked` (27)

🇺🇸 **Descriptions(≤90 chars):**
1. `Skip the CUDA and Docker setup. One installer picks the right model for your GPU.` (80)
2. `Run open-source LLMs locally on Windows + NVIDIA. Free to start, no signup needed.` (81)
3. `Hardware-aware model routing. Drag in docs for RAG. Everything runs offline.` (75)

🇺🇸 **Keywords:** `run local llm`, `local llm windows`, `local llm nvidia`, `easiest local llm`, `local llm installer`, `open source llm app`, `local rag`, `[phrase] "local llm no coding"`

---

#### Ad Group 3 — 意图:Chat With Your PDFs(文档问答)

🇺🇸 **Headlines(≤30 chars):**
1. `Chat With Your PDFs` (19)
2. `Ask Your Documents Anything` (27)
3. `Private PDF AI, Offline` (23)
4. `Chat With Files, Privately` (26)
5. `AI For Your PDFs & Excel` (24)

🇺🇸 **Descriptions(≤90 chars):**
1. `Drag in PDFs, Word & Excel. Ask questions, get answers with cited sources.` (74)
2. `Your files never upload. Chat with documents offline on your own computer.` (74)
3. `No account needed to start. Build a private document AI in about 20 minutes.` (76)

🇺🇸 **Keywords:** `chat with pdf`, `chat with pdf offline`, `chat with pdf privately`, `ai read my documents`, `ask questions about pdf`, `excel ai assistant`, `[exact] "private chat with pdf"`

🇨🇳 **Sitelink / 附加信息(通用):**
- `Free to Start` → build.html
- `How It Works` → index.html#how
- `Pricing` → index.html#pricing
- `See a Demo` → chat.html

---

### 4.h Email 序列(3 封)

🇨🇳 **说明**:Beta 期 Pro/Business 才需要账户,所以邮件序列主要面向**注册了免费账户或订阅了 newsletter 的人**。每封给 2 个 A/B 主题行。正文简短、口语、单一 CTA。

---

#### Email 1 — Welcome(注册/下载后立即发)

🇺🇸 **Subject A:** `You're in. Here's how to build your first AI (20 min)`
🇺🇸 **Subject B:** `Welcome — let's get your private AI running`

🇺🇸 **正文(英文成稿):**
> Hey [First Name],
>
> Welcome — you're all set to build your first private AI. Here's the honest truth: the hardest part is already behind you, because there's basically nothing to configure.
>
> Three steps, about 20 minutes:
>
> **1. Tell it what you want.** In plain English — like "an AI that reads my PDFs." No model names, no jargon.
> **2. Click install.** It already checked your PC and picked the right model. One installer. No Docker, no terminal.
> **3. Drag in your files.** PDFs, Word, Excel. Then ask questions and get answers with sources you can click and verify.
>
> Everything runs on your computer. Your files never leave it.
>
> 👉 [Start building — it's free](URL)
>
> If you get stuck anywhere, just reply to this email. A real person (me) reads these.
>
> — [Your name], Build My AI
>
> P.S. Want to see it done first? Here's a 10-minute walkthrough where I build one from scratch: [YouTube URL]

---

#### Email 2 — Activation Nudge(注册后 48h 未激活发)

🇺🇸 **Subject A:** `Still thinking about it? Here's the 2-minute version`
🇺🇸 **Subject B:** `Your private AI is one click away`

🇺🇸 **正文(英文成稿):**
> Hey [First Name],
>
> You signed up to build your own private AI but haven't set it up yet — totally fine, life's busy. I just want to make sure nothing's in your way.
>
> The most common reason people pause is they assume it'll be complicated. It isn't. There's no coding, no Docker, and nothing to figure out — you type what you want, click once, and drag in your files. That's the whole thing.
>
> If you *did* hit a snag, I'd genuinely like to know what it was — just hit reply.
>
> 👉 [Pick up where you left off](URL)
>
> And if you're on the fence about whether local AI is "good enough": for working with your own documents privately, it's genuinely great. It just won't leak them. That's the point.
>
> — [Your name]

---

#### Email 3 — Free → Pro Upgrade(活跃免费用户,用量达到某阈值后发)

🇺🇸 **Subject A:** `You've been using your AI a lot — here's what Pro adds`
🇺🇸 **Subject B:** `Ready to give your private AI more room?`

🇺🇸 **正文(英文成稿):**
> Hey [First Name],
>
> You've clearly been putting your private AI to work — that's exactly what I hoped to see. If it's become part of how you get things done, Pro is built for people right where you are.
>
> **What Pro ($29/mo) adds:**
> - Bigger, smarter models (as much as your hardware can handle)
> - More documents indexed at once for larger knowledge bases
> - A more powerful "Teach My AI" so it adapts faster to how you work
> - Priority support — you reply, I actually answer
>
> Same promise, more power: everything still runs locally, and your files still never leave your computer.
>
> During the beta it's free, so this is really just a heads-up on where things are headed — and a chance to lock in early if you want.
>
> 👉 [See what Pro includes](URL)
>
> Either way, thank you for building with me this early. It means a lot.
>
> — [Your name]
>
> P.S. Running a team or business? Business plans start at $299/mo with multi-user setup — just reply and I'll walk you through it.

🇨🇳 **说明**:Email 3 明确点出 Beta 免费(诚实),不制造虚假紧迫感。Pro 的卖点措辞需与 [`docs/05`](./05-business-model.md) 保持一致——上线前对齐功能清单。

---

### 4.i LinkedIn 帖(面向 SMB / 专业人士)

🇺🇸 **正文(英文成稿):**
> Most small businesses I talk to have the same quiet problem with AI:
>
> They know it could help — with contracts, SOPs, client files, spreadsheets — but they can't put any of that into a public AI tool. It's confidential. Sometimes it's regulated. And "we promise we don't train on your data" isn't a compliance policy.
>
> So they just… don't use AI for the work that would benefit most. The sensitive work.
>
> The fix turns out to be simpler than most people expect: run the AI *locally*, on a computer you already own, so nothing ever gets uploaded. The only reason more businesses don't is that setting that up used to require an engineer.
>
> That's the gap we built Build My AI to close. You describe what you need in plain English, it sets itself up on your Windows + NVIDIA machine in about 20 minutes, and then it reads your documents and answers questions with citations — entirely offline. No IT team, no per-seat cloud contract, no files leaving the building.
>
> I'll be honest about the tradeoff: a local model won't beat a frontier cloud model on general reasoning. But for private work on your own documents, that's not the comparison that matters. "Useful and confidential" beats "brilliant and off-limits."
>
> It's free to start. If your team has been holding back on AI because of where the data goes, this might be the version you can actually say yes to.
>
> Link in the comments. Happy to answer questions here.
>
> #SmallBusiness #AI #DataPrivacy #Productivity

🇨🇳 **说明**:LinkedIn 语气更克制专业,链接放评论区(平台对外链降权)。锚定"合规/机密"痛点,直接指向 Business 计划线索。

---

## 5. SEO / 关键词地图

🇨🇳 按**搜索意图**分组。每组标注对应落地页/教程,保证"关键词—页面"一一对应。

### 5.1 关键词按意图分组

| 意图分组 | 核心关键词 | 长尾关键词 | 对应页面 / 内容 |
|---------|-----------|-----------|----------------|
| **隐私 AI(核心)** | private ai, private ai assistant | private ai for documents, ai that doesn't send data to cloud, secure ai for sensitive files | `index.html`(隐私 hero 变体)+ 教程 #1 |
| **本地 LLM(技术)** | local llm, run local llm | run local llm windows, local llm no docker, easiest local llm for beginners, local llm nvidia gpu | 教程 #2 + `build.html` |
| **文档问答** | chat with pdf, ai for pdf | chat with pdf offline, ask questions about my documents, chat with excel privately | 教程 #3 + `chat.html` 演示 |
| **ChatGPT 替代** | chatgpt alternative | private chatgpt alternative, chatgpt alternative that keeps data private, offline chatgpt | 教程 #4 |
| **行业场景** | ai for lawyers, ai for small business | ai for lawyers confidentiality, private ai for accountants, ai assistant for small business | 教程 #5、#9 + LinkedIn |
| **研究** | ai literature review | ai for research papers with citations, chat with research pdfs | 教程 #6 |
| **成本对比** | ai subscription cost | cost of running local ai vs chatgpt, free chatgpt alternative | 教程 #7 |
| **模型选择** | best open source llm | which local llm should i run, best llm for 8gb vram | 教程 #8 |

### 5.2 落地页—关键词映射原则

🇨🇳
- **`index.html`**:承接品牌词 + "private ai"泛意图。H1 用 Tagline #1 或 #6。
- **`build.html`**:承接"run local llm / installer"类高意图动作词,页面 CTA = 开始构建。
- **`chat.html`**:承接"chat with pdf / demo"类,展示带引用问答。
- **教程博客**:每篇 target 一个长尾主关键词,内部链接指向对应产品页,形成 topic cluster(隐私 / 本地 LLM / 文档问答三大簇)。
- 每个页面 title/meta description 复用 §1.3 的 headline,避免重复 title。

---

## 6. 发布日历(30 / 60 / 90 天)

🇨🇳 三阶段:**软启动(建信任)→ 社区放大 → 发布日爆发 + 付费放量**。日期为相对周,可平移。

### 阶段一:0–30 天 · Beta 软启动(埋种子)

| 周 | 渠道 | 动作 | 交付物 |
|----|------|------|--------|
| W1 | 内容 | 发布教程博客 #1、#2 | 2 篇 SEO 文 |
| W1 | YouTube | 上线主教程视频(§4.a) | 1 长视频 |
| W2 | Reddit | 发 r/LocalLLaMA Show 帖(§4.c#1) | 1 帖 + 蹲评论 |
| W2 | 短视频 | 发短视频 #1(隐私)(§4.b) | 1 竖屏 |
| W3 | Reddit | 发 r/privacy 帖(§4.c#2) | 1 帖 |
| W3 | X | 开始 build-in-public,发独立推文 #1–#3 | 3 推 |
| W4 | Email | 配好 Welcome + Activation 序列(§4.h) | 2 封自动化 |
| W4 | 复盘 | 看哪条 message/hook 最转化,定发布日主叙事 | 数据 memo |

### 阶段二:31–60 天 · 社区放大

| 周 | 渠道 | 动作 | 交付物 |
|----|------|------|--------|
| W5 | 内容 | 教程 #3、#9 + 短视频 #2(非技术) | 2 文 1 视频 |
| W6 | Reddit | r/smallbusiness 场景帖(改写 §4.i 角度) | 1 帖 |
| W6 | LinkedIn | 发 SMB 帖(§4.i) | 1 帖 |
| W7 | 内容 | 教程 #5(律师)、#7(成本)+ 短视频 #3 | 2 文 1 视频 |
| W7 | X | 发独立推文 #4–#5 | 2 推 |
| W8 | 筹备 | 准备 PH/HN 发布物料、预热邮件、招募早鸟 upvoter | 发布清单 |

### 阶段三:61–90 天 · 发布日 + 付费放量

| 周 | 渠道 | 动作 | 交付物 |
|----|------|------|--------|
| W9 | **Product Hunt** | 发布日(§4.e),全天回评 | PH launch |
| W9 | **Hacker News** | 同周发 Show HN(§4.d) | HN 帖 |
| W9 | X | 发 Launch Thread(§4.f),动员 RT | 1 thread |
| W10 | Google Ads | 上线 3 个 Ad Group(§4.g),小预算测 | 付费测试 |
| W10 | Email | 对活跃用户发 Free→Pro(§4.h#3) | 1 封 |
| W11 | 优化 | 按 Ad/落地页数据关停差组、加码优组 | 优化 memo |
| W12 | 放量 | 扩量表现最好的付费渠道 + 内容再投放 | 规模化计划 |

---

## 7. 衡量与预算

🇨🇳 **全部为假设值 `(假设)`**,上线后用真实数据替换。目的是先建立指标框架和归因方法。

### 7.1 各渠道核心指标

| 渠道 | 主指标 | 次指标 | 目标(假设) |
|------|--------|--------|-------------|
| YouTube 长视频 | 观看→点击落地页 CTR | 平均观看时长、订阅 | CTR ≥ 4%(假设) |
| 短视频 | 完播率、bio 点击 | 分享/存 | 完播 ≥ 30%(假设) |
| Reddit | 帖→落地页点击、评论质量 | upvote 比 | 单帖 ≥ 200 clicks(假设) |
| SEO 博客 | 自然点击、关键词排名 | 页面停留 | 90 天进前 3 页(假设) |
| Product Hunt | 当日名次、访问 | 评论数 | Top 5 of day(假设) |
| Google Ads | CTR、CVR(→开始构建) | CPC、质量得分 | CVR ≥ 6%(假设) |
| Email | 打开率、点击率、激活 | 退订率 | 激活 ≥ 25%(假设) |
| 全站 | Free 激活率、Free→Pro 转化 | 留存 | Free→Pro ≥ 3%(假设) |

### 7.2 CAC 目标假设

🇨🇳
- **有机渠道(Reddit/SEO/YouTube 自然)**:目标 CAC 主要是时间成本,趋近于 $0 现金 `(假设)`。
- **付费渠道(Google Ads)**:目标 **付费 CAC ≤ $60** `(假设)`,对照 Pro 年 LTV(见 [`docs/12`](./12-business-plan.md) / [`docs/05`](./05-business-model.md))判断可承受上限。Pro $29/mo 若留存 12 个月 → LTV ≈ $348 `(假设)`,则 CAC/LTV 应 < 1/3,即 CAC 天花板约 $115 `(假设)`。
- 优先扩量的是**有机 + 高质量社区**,付费只买高意图搜索词,不买泛展示。

### 7.3 UTM / 归因规范

🇨🇳 统一 UTM 命名,进 GA/自建看板:

```
utm_source   = youtube | reddit | producthunt | hackernews | x | google | linkedin | email
utm_medium   = video | social | community | cpc | email | organic
utm_campaign = beta-softlaunch | ph-launch | q3-search
utm_content  = 具体素材,如 short-privacy-01 / rebuttal-comment / ad-group-privatepdf
```

- 落地页按受众加 `?aud=smb|pro|research|privacy`(见 §1.4)做分流分析。
- Beta 期无强登录,用**匿名 usage id**做激活漏斗(需与隐私声明一致,见 §8)。
- 每条对外链接都带 UTM;短视频 bio/评论链接用短链承载 UTM。

### 7.4 预算分配建议(发布季,假设)

| 项目 | 占比(假设) | 说明 |
|------|-----------|------|
| 内容制作(视频/博客) | 40% | 主引擎,长期资产 |
| Google Ads 测试 | 25% | 只测高意图词 |
| 短视频投放/加热 | 15% | 放大验证过的 hook |
| PH/HN 发布支持 | 10% | 物料、设计 |
| 工具/归因/落地页优化 | 10% | 分析与 A/B |

---

## 8. 品牌与合规注意

🇨🇳 隐私是本产品的核心承诺,**营销宣称必须能兑现**,否则反噬最严重。

### 8.1 诚实营销红线

- ✅ **可以说**:*"Your data never leaves your computer" / "runs offline" / "free to start, no signup"* —— 前提是产品**确实**如此(本地 RAG、匿名 usage data)。
- ⚠️ **必须澄清**:如果收集**匿名使用数据**,文案里的"nothing leaves your computer"要精确为 *"your **files/documents** never leave your computer"*,并在隐私页说明匿名遥测。**文档 ≠ 遥测**,措辞别混。
- ❌ **不要说**:"100% no data collected"(若有匿名遥测则不实)、"forever free"(定价含 Pro/Business)、"better than ChatGPT"(§8.3 商标 + 夸大)。

### 8.2 隐私宣称的可兑现清单

| 宣称 | 兑现条件 | 谁负责 |
|------|---------|--------|
| "Files never leave your computer" | RAG 索引与推理全本地,无文档上传 | 工程 |
| "Works offline" | 安装后断网可用(视频要真演示) | 工程 |
| "Free to start, no signup" | Free 层确实无需注册 | 产品 |
| "Anonymous usage data only" | 遥测不含个人身份/文件内容,可关闭 | 工程 + 法务 |

### 8.3 开源模型 License 与商标

🇨🇳
- **模型 License**:分发/推荐开源模型前,逐个核对其 License(如 Llama 社区许可、Apache-2.0、Qwen 许可等)对**再分发、商用、命名署名**的要求。Business 商用尤其要确认允许商用。See also [`docs/11`](./11-ai-architecture-and-model-routing.md) 模型路由清单。
- **商标**:不得暗示与 OpenAI/ChatGPT、NVIDIA、Microsoft 等有官方关联或背书。用 "ChatGPT-style" / "ChatGPT alternative" 做**描述性/比较性**表述可以,但**不要**把 "ChatGPT" 放进产品名、logo、域名,或写成 "the new ChatGPT"。"Windows" / "NVIDIA" 仅作兼容性说明("for Windows + NVIDIA PCs"),不做背书暗示。
- **比较广告**:任何"vs ChatGPT / vs 订阅"内容基于**事实与场景**(隐私、本地、成本),不贬低、不虚假对比。

### 8.4 不夸大原则(贯穿全文脚本)

🇨🇳 本文所有脚本都刻意保留了**主动承认局限**的句子(*"a local model won't out-reason a frontier cloud model on general reasoning"*)。这不是软弱,而是本品牌可信度的核心资产,面向的又是隐私敏感、反营销的人群。**审稿时不要为了"更有力"而删掉这些句子。**

---

## 交叉引用(Cross-links)

- 商业模式、单元经济与 Go-to-Market 策略(§7):[`docs/12-business-plan.md`](./12-business-plan.md)
- 定价与套餐(Pro/Business 功能清单,邮件/广告需对齐):[`docs/05-business-model.md`](./05-business-model.md)
- AI 架构与模型路由(License 核对、推荐模型依据):[`docs/11-ai-architecture-and-model-routing.md`](./11-ai-architecture-and-model-routing.md)
- 落地页与演示(投放去向):[`web/index.html`](../web/index.html)、[`web/build.html`](../web/build.html)、[`web/chat.html`](../web/chat.html)、[`web/dashboard.html`](../web/dashboard.html)、[`web/signup.html`](../web/signup.html)

---

> **维护说明**:本文的英文成稿为"可发布母版"。每次投放后,把真实数据回填到 §7 指标表,并把表现最好的 hook/headline 标记为"已验证",反哺 §1.3 与 §4。所有 `(假设)` 数字在有真实数据后替换并去掉标注。
