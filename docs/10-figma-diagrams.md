# 10 · Figma 图表(流程图与架构)

> 用 FigJam 绘制,链接为"认领并编辑"地址。首次点击会把图收进你的 Figma(michael.yan@purehd.com)。
> 图的 Mermaid 源码一并存档于此,方便版本管理与随时重生成。

## 图表清单

| # | 图 | 打开链接 |
|---|-----|----------|
| 01 | 端到端产品流程图 | https://www.figma.com/board/UhRRICw1kkxDgpa73JtXqE |
| 02 | 六大核心模块系统架构 | https://www.figma.com/board/b6Drqbqsr8lBytyapgdz5N |
| 03 | MVP 技术架构(Windows + NVIDIA) | https://www.figma.com/board/abmkQ5vIh5ZMY8sB078W0p |
| 04 | 护城河数据飞轮 | https://www.figma.com/board/pb1VyFWcQaFi27Y1lOpCnr |
| 05 | MVP 里程碑路线图(M0-M4) | https://www.figma.com/board/taWwx0iOYTFrkPS65RXpaU |

---

## 如何维护

- 修改图:直接在 FigJam 里拖拽/改字。
- 结构性大改:改下面的 Mermaid 源码,重新用工具生成一张新图(FigJam 内单个图形无法用工具批量重排)。
- 一张图对应一个 FigJam 文件。

---

## 源码存档

### 01 端到端产品流程图

```mermaid
flowchart TD
    A["1 需求选择：用自然语言描述想要的 AI"] --> B["2 设备检测：CPU / GPU / RAM / VRAM / 系统"]
    B --> C{"设备是否满足要求？"}
    C -->|"满足"| D["3 AI 推荐方案（用人话展示）"]
    C -->|"不满足"| E["提示升级硬件 或 选择云 GPU（Phase 1）"]
    E --> D
    D --> F{"4 本地 还是 云端？"}
    F -->|"本地"| G["5 自动安装：运行时 + 模型 + RAG + Web UI"]
    F -->|"云端"| G
    G --> H["6 添加个人知识：拖入 PDF / Word / Excel / 邮件"]
    H --> I["7 RAG：解析→切片→Embedding→索引→检索"]
    I --> J["8 使用：Web UI 或 API"]
    J --> K["9 收集反馈：AI 回答→用户修改→正确答案"]
    K --> L{"反馈数据是否足够？"}
    L -->|"不够"| J
    L -->|"足够"| M["10 微调：LoRA / Fine-tuning"]
    M --> N["11 API / 工具接入：连接软件与工作流"]
    N --> J
```

### 02 六大核心模块系统架构

```mermaid
flowchart TB
    U["用户：一句话需求"] --> ADV["模块1 · AI 方案顾问：用途/预算/隐私/速度/人数 → 方案"]
    REG["模块6 · Model Registry：模型版本/License/硬件/能力/兼容性"] -.->|"实测数据支撑推荐"| ADV
    ADV --> DEP["模块2 · 自动部署系统：检测硬件 + 装运行时/模型/RAG/UI"]
    DEP --> CC["模块3 · AI Control Center：管理 模型/知识库/API/Memory/工具/状态"]
    CC --> RAG["模块4 · Knowledge / RAG：解析→切片→Embedding→索引→检索"]
    CC --> TEACH["模块5 · Teach My AI：回答→修改→正确答案 → LoRA"]
    RAG --> TEACH
    DEP -.->|"部署成败数据"| MOAT["AI Deployment Intelligence（护城河数据飞轮）"]
    RAG -.->|"检索质量数据"| MOAT
    TEACH -.->|"能力边界与反馈数据"| MOAT
    MOAT -.->|"让推荐越来越准"| ADV
```

### 03 MVP 技术架构(Windows + NVIDIA)

```mermaid
flowchart TB
    subgraph L1["用户交互层"]
        UI["Web UI：对话 + 知识库管理"]
        API["本地 API：OpenAI 兼容 /v1/chat/completions"]
    end
    subgraph L2["应用逻辑层"]
        ADV["方案顾问（规则表：场景 x VRAM → 方案）"]
        RAGSVC["RAG 服务：解析 / 切片 / 检索 / 来源引用"]
        MGR["服务管理：启动 / 重启 / 端口 / 日志"]
    end
    subgraph L3["AI 运行时层"]
        INF["推理运行时：llama.cpp server（GGUF + CUDA）"]
        EMB["Embedding 模型（本地英文优化）"]
        VDB["向量库：Chroma / Qdrant（本地）"]
    end
    subgraph L4["系统与硬件层"]
        DET["设备检测：CPU/GPU/RAM/VRAM/驱动"]
        GPU["NVIDIA GPU + CUDA 驱动"]
        OS["Windows 10 / 11"]
    end
    UI --> ADV
    UI --> RAGSVC
    API --> INF
    ADV --> INF
    RAGSVC --> EMB
    RAGSVC --> VDB
    RAGSVC --> INF
    MGR --> INF
    INF --> GPU
    EMB --> GPU
    DET --> GPU
    GPU --> OS
```

### 04 护城河数据飞轮

```mermaid
flowchart LR
    A["更多用户使用"] --> B["更多真实部署数据：需求 x 硬件 x 任务 x 成败"]
    B --> C["推荐引擎更准：什么硬件+什么任务=什么方案最好"]
    C --> D["安装成功率更高、效果更好"]
    D --> E["口碑与转化更好"]
    E --> A
    B -.->|"喂养"| DI["AI Deployment Intelligence"]
    DI -.->|"驱动"| C
```

### 05 MVP 里程碑路线图(M0-M4)

```mermaid
flowchart LR
    M0["M0 技术骨架与选型：关键路径手动跑通（~10 人日）"] --> M1["M1 一键安装与推理：双击安装→模型能回答（~18 人日）"]
    M1 --> M2["M2 方案顾问与对话 UI：检测→人话方案→网页对话（~14 人日）"]
    M2 --> M3["M3 RAG 知识库：拖入 PDF→带来源回答（~16 人日）"]
    M3 --> M4["M4 API/埋点/打包/Beta：签名安装包 + 真实用户实测（~14 人日）"]
    M4 --> GOAL{"成功标准：普通人 30 分钟内拥有本地 AI？"}
    GOAL -->|"达标"| NEXT["Phase 1：macOS / 云 GPU / Memory / 微调"]
    GOAL -->|"未达标"| ITER["迭代安装体验，不扩范围"]
    ITER --> M1
```

---

相关文档:[02 产品概览](02-product-overview.md) · [03 核心模块](03-core-modules.md) · [09 MVP 工程任务清单](09-mvp-engineering-tasks.md)
