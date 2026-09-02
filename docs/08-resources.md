# 08 · 资源与链接(美国生态)

> 目标市场为美国,所有依赖的资源、下载源、云服务均以美国本土可直接访问的官方渠道为准。

## 模型托管与下载

| 资源 | 链接 | 用途 |
|------|------|------|
| Hugging Face | https://huggingface.co | 开源模型权重主下载源(Model Registry 数据来源) |
| Meta Llama | https://www.llama.com | Llama 系列官方发布与 License |
| Mistral AI | https://mistral.ai | Mistral 系列开源模型 |
| NVIDIA NGC | https://catalog.ngc.nvidia.com | NVIDIA 优化模型与容器 |

## 推理运行时(本地部署候选)

| 资源 | 链接 | 说明 |
|------|------|------|
| llama.cpp | https://github.com/ggml-org/llama.cpp | GGUF 量化推理,Windows + NVIDIA 支持好 |
| Ollama | https://ollama.com | 模型运行与管理(可作为底层之一,非护城河) |
| vLLM | https://github.com/vllm-project/vllm | 高吞吐推理,后期多用户/企业场景 |
| LM Studio | https://lmstudio.ai | 竞品参照 + 生态观察 |

## RAG 组件

| 资源 | 链接 | 说明 |
|------|------|------|
| LangChain | https://www.langchain.com | 文档解析与 RAG 编排(可选) |
| LlamaIndex | https://www.llamaindex.ai | RAG 框架(可选) |
| Chroma | https://www.trychroma.com | 本地向量库候选 |
| Qdrant | https://qdrant.tech | 向量库候选(可本地可云) |
| sentence-transformers | https://www.sbert.net | 英文 Embedding 模型 |

## 硬件与驱动(Windows + NVIDIA,MVP 范围)

| 资源 | 链接 | 说明 |
|------|------|------|
| NVIDIA 驱动 | https://www.nvidia.com/en-us/drivers/ | 自动部署系统需检测/引导更新 |
| CUDA Toolkit | https://developer.nvidia.com/cuda-toolkit | 运行时依赖 |
| GPU 规格参考 | https://www.techpowerup.com/gpu-specs/ | 设备检测的 VRAM 数据校对 |

## 云 GPU(设备不够时,用户自带账号自付费,美国区域)

> 本地设备跑不动时的出路。这些是用户**自己的**云账号、账单直接付给云厂商——项目不经手、不抽成(见 [21 Lambda 云集成](21-lambda-cloud-integration.md) 的 BYO-key 模式)。

| 资源 | 链接 | 说明 |
|------|------|------|
| RunPod | https://www.runpod.io | 按量 GPU,美国数据中心 |
| Lambda | https://lambda.ai | 美国 GPU 云(一键集成,用户自付) |
| AWS (us-east/us-west) | https://aws.amazon.com/ec2/instance-types/g6/ | 通用云 GPU |
| CoreWeave | https://www.coreweave.com | 规模化 GPU |

## 合规与 License(美国市场必查)

- 每个上架模型必须核对 License 是否允许**再分发/使用**(Llama 社区协议、Apache 2.0、MIT 各不相同);registry 里逐模型标注,用户能看到自己选的模型能不能商用
- 用户数据默认本地存储;涉及云端时注意美国各州隐私法(如 CCPA/CPRA)

---

相关文档:[03 核心模块](03-core-modules.md) · [04 MVP 范围](04-mvp.md) · [21 Lambda 云集成](21-lambda-cloud-integration.md)
