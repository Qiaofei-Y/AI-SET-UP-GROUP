# 代码签名:Azure Trusted Signing vs 传统 EV token

> 决策(2026-09-01):**采用 Azure Trusted Signing(ATS)**。主因是**云 CI 自动签名**——OIDC 无长期密钥、无实体 USB token,契合 GitHub Actions;传统 EV token 在 GitHub 托管 runner 上几乎无法自动化。骨架已预置(`.github/workflows/sign-desktop.yml`),**未激活**,待账户/凭据/产物齐备。价格与主体验证门槛以微软/CA 当时官网为准,下表只给量级与方向。

## 利弊对比

| 维度 | Azure Trusted Signing(选中) | 传统 EV 证书 + token |
|---|---|---|
| **密钥保管** | 微软托管 HSM(FIPS 140-2 L3),**无实体 token** | 实体 USB token 或自购云 HSM,需人保管/插拔 |
| **CI 自动签名** | ✅ `azure/login` OIDC + `azure/trusted-signing-action`,**无长期密钥、无插 token** | ✗ 实体 token 插不进托管 runner;要么自托管 runner + 插 token(脆),要么改买云 HSM 变体(又回到托管思路) |
| **成本模型** | 按月计费(basic tier 低) + 按签名量;门槛在**主体验证**而非钱 | 证书年费(数百刀级)+ token/HSM 费 |
| **SmartScreen/声誉** | 微软受信任根,建立发布者声誉;近年与 EV 实质等效(核实当下策略) | EV 传统即时获得 SmartScreen 信誉 |
| **主体验证** | 需企业实体验证(Public Trust 身份校验;**新主体可能有存续年限或额外验证门槛——务必先核实**) | 需企业实体验证(D-U-N-S 等) |
| **证书生命周期** | 微软托管轮换,对 CI 透明 | 到期需重新签发 + 重配 CI |
| **供应商锁定** | 绑 Azure | 证书可移植性稍好,但 CI 痛点抵消优势 |

## 为什么选 ATS

1. **本项目要在 CI 自动出签名安装器**(批次 2 目标),ATS 是唯一能在 GitHub 托管 runner 上**全自动、无密钥**签名的路径。
2. 免自管 HSM/token,减少一个「人保管密钥」的运维与丢失风险面。
3. 与已有云托管基建(如 SES 等美国托管服务)运维心智一致。

**唯一需先确认的风险**:ATS 对**新公司主体**的身份验证门槛(部分文档提到组织存续要求)。若新主体暂不满足,退路是先用传统 OV/EV 过渡、主体满足后迁 ATS——但优先直接确认 ATS 门槛。**这是启动前要落实的第一件事。**

## 启动前置(按序)

1. 公司主体已注册(批次 0)+ D-U-N-S 号(dnb.com,免费但耗时)。
2. Azure 订阅 → 建 **Trusted Signing account** + **certificate profile**(Public Trust 类型)→ 通过微软身份验证。
3. 建 Azure AD 应用/服务主体,给它对签名账户授 **Trusted Signing Certificate Profile Signer** 角色。
4. 配 **GitHub OIDC 联合凭据**(federated credential)绑到该 SP(限定本仓库 + 环境),**无 client secret**。
5. 在仓库 **Variables**(非机密)填:`AZURE_SIGNING_ENDPOINT`(区域端点,如 `https://eus.codesigning.azure.net`)、`AZURE_SIGNING_ACCOUNT`、`AZURE_SIGNING_PROFILE`、`AZURE_CLIENT_ID`、`AZURE_TENANT_ID`、`AZURE_SUBSCRIPTION_ID`。

## CI 集成(骨架已就绪)

`.github/workflows/sign-desktop.yml`:
- **仅 `workflow_dispatch` 触发**——不进 PR/push 门禁,永远不会让普通 PR 变红。
- **windows runner** + **OIDC 登录**(`permissions: id-token: write`,无长期密钥)。
- **preflight 守卫**:上述 Variables 未配齐则打印缺项 + 指引并 **no-op 通过**(不假装签名)。
- 配齐后触发:定位 `dist/*.msi` → `azure/login` → `azure/trusted-signing-action` 签名 + RFC3161 时间戳。
- **激活前两件事**:① 把 action 版本 pin 到具体 commit SHA;② desktop 构建 job 产出 `dist/*.msi`(需 Rust/Tauri,见批次 2 本体)。

## 状态

- ☑ 决策:Azure Trusted Signing。
- ☑ 分析 + CI 骨架预置(本文件 + `sign-desktop.yml`,未激活)。
- ☐ 外部:确认 ATS 主体验证门槛 → 建账户/profile/OIDC → 填 Variables。
- ☐ 代码:desktop 构建 job 产出 `.msi`(批次 2 本体)。
