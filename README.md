# ComfyUI Good Anima 🎨

> 一套面向 AI 编程助手的 ComfyUI + Anima 二次元生图技能包。
>
> 🌐 **[English Version](./README_EN.md)**

---

## 📋 概述

**ComfyUI Good Anima** 是一组 AI Agent Skills（技能文件），专为 **Anima 二次元图片生成模型** 设计，配合 **ComfyUI** 使用。它通过结构化的 Skill 指导 AI 编程助手完成完整的生图流程：

1. 🎬 **构图规划** — 根据语义描述选择画幅、镜头、构图、光影
2. 🔍 **标签检索** — 通过 Danbooru 标签索引检索并验证角色、画师、服装等锚点
3. 🔧 **Prompt 组装** — 按 Anima 官方规范组装正向/负向提示词
4. ⚡ **工作流执行** — 调用 ComfyUI 工作流完成生图、放大和缓存

### 兼容的 AI 编程助手

本项目的 Skills 为 **AI 编程代理（AI Coding Agent）** 设计，任何能执行 Shell 命令的 AI 助手均可使用：

| 助手                 | 支持状态    | 说明                                              |
| -------------------- | ----------- | ------------------------------------------------- |
| **🟢 Snow**          | ✅ 完美支持 | **国内首选推荐** — 原生支持 Skills 系统，即开即用 |
| **🟢 Claude Code**   | ✅ 完美支持 | Anthropic 官方 CLI，支持 Shell 命令执行           |
| **🟢 Codex**         | ✅ 完美支持 | 全功能 AI 编程代理，完全兼容                      |
| **🟢 PI**            | ✅ 完美支持 | 轻量级 AI 编程代理，支持 Skills 系统              |
| **🟢 OpenClaw**      | ✅ 支持     | 支持 ComfyUI_Skill_CLI 集成的 Agents              |
| **🟡 其他 AI Agent** | ✅ 完美支持 | 只要能执行 PowerShell/Shell 命令即可              |

> 💡 **推荐使用 [Snow](https://snowcli.com/docs) — 目前国内体验最好的 AI 编程代理**。

### 包含的 Skills

```
comfyui-good-anima/
├── anima-composition-director/    # 构图指导 — 画幅/镜头/构图/光影决策
├── anima-random-gen/              # 随机图生成 — 随机画师/标签/参数产出
├── comfyui-animatool/            # 生图入口 — prompt 组装与参数策略
├── comfyui-manager/              # ComfyUI 管理器 — 工作流执行/模型管理
└── danbooru-tags/                # 🔍 标签检索器 — 详见下方说明
```

### 🔍 danbooru-tags 是什么？为什么要用它？

**danbooru-tags** 是本项目中最关键的检索基础设施。它是一个 Rust 编写的命令行工具，负责对 **Anima 官方标签索引（anima-1.0.csv）** 进行高速检索和锚点校验。

#### 它解决的核心问题

Anima 模型是在 Danbooru 标签系统上训练的，想要精确控制生成内容，就必须使用 **Danbooru 体系内的有效标签**。但 Danbooru 有数百万个标签，人工记忆和拼写几乎不可能。danbooru-tags 解决了以下痛点：

| 痛点           | 没有 danbooru-tags 会怎样                                                                | 有 danbooru-tags 后                                                |
| -------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| **画师校验**   | 用户说"用 rella 画风"，AI 不知道 `@rella` 是不是有效 tag，可能写出无效画师名导致模型忽略 | `--group artist --prefix "@rella"` 直接返回 confirmed 画师         |
| **角色确认**   | "立华奏"在 Danbooru 里叫 `kanade tachibana`，AI 可能猜错或漏掉                           | 批量查询 `--group character --keyword "kanade tachibana"` 精准命中 |
| **标签准确性** | 随便写的 `巫女服` 不是有效 Danbooru tag，模型不理解                                      | 拆解为 `miko`, `hakama`, `wide sleeves` 等多角度候选供筛选         |
| **随机抽卡**   | 无法在有效标签范围内做随机选择                                                           | `--random 5 --for-prompt` 直接给出可用的随机画师                   |
| **批量检索**   | 每查一个 tag 都要调一次，慢且低效                                                        | `--batch-file` 一次查 12-16 个 query，并发 8 线程                  |

#### 工作方式

```
anima-1.0.csv (官方索引)
       ↓
 build_index.py + sqlite_index.py (构建索引)
       ↓
tags_index.sqlite (高速本地索引)
       ↓
 bin/danbooru-tags.exe (Rust CLI)
       ↓
 AI 助手用 --group / --random / --batch-file 检索
 获得 confirmed_tags / candidate_tags 用于 prompt 组装
```

#### 没有它行不行？

**不行。** 没有 danbooru-tags，AI 助手就无法确认画师名是否有效、角色 tag 是否拼写正确、随机抽到的标签是否在 Anima 模型的理解范围内。整个生图流程就变成了"盲写 prompt，撞大运出图"，完全失去了精确控制的能力。

---

## 🖼️ 案例展示

以下是由 ComfyUI Good Anima + Anima base v1.0 生成的示例图片（画师：rella）：

| 作品                                                                                            | 描述                                            |
| ----------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| ![小野塚小町×四季映姫](samples/anima_base_v1_0-rella-flw-onozuka_komachi_shiki_eiki_00001_.png) | 东方 project — 小野塚小町与四季映姫，花映塚主题 |
| ![宫古芳香×霍青蛾](samples/anima_base_v1_0-rella-inc-miyako_yoshika_kaku_seiga_00001_.png)      | 东方 project — 宫古芳香与霍青蛾，神灵庙主题     |
| ![八云紫×八云蓝](samples/anima_base_v1_0-rella-pcb-yakumo_yukari_ran_yakumo_00001_.png)         | 东方 project — 八云紫与八云蓝，妖妖梦主题       |

---

## 🖥️ 运行环境

| 依赖                  | 版本要求       | 说明                                                |
| --------------------- | -------------- | --------------------------------------------------- |
| **操作系统**          | Windows 10/11  | PowerShell 5.x+，本项目使用 Windows PowerShell 语法 |
| **ComfyUI**           | 最新版         | 图片生成后端                                        |
| **comfyui-skill-cli** | 最新版         | agent 代理与 ComfyUI 之间的桥梁                     |
| **Node.js**           | 18+            | 用于运行工作流执行脚本                              |
| **Python**            | 3.10+          | 仅标签索引初始化时需要，日常生图不需要              |
| **NVIDIA GPU**        | 8GB+ VRAM      | 推荐 12GB+，用于 Anima 推理和 RTX VSR 放大          |
| **CUDA**              | 12.8+          | GPU 加速必需                                        |
| **PyTorch**           | 兼容 CUDA 12.8 | 配合 xformers 0.0.3.0 使用                          |
| **xformers**          | 0.0.3.0        | 内存优化加速                                        |

### ComfyUI 启动推荐

使用 Sage Attention 模式启动可获得最佳性能（需 ANIMA_BOOSTER 节点支持）：

```powershell
python main.py --use-sage-attention
```

或在 ComfyUI 启动参数中添加 `--use-sage-attention` 启用。AnimaBoosterLoader 节点中也可将 `sage_attention` 设置为 `enabled`。

> **注意：** 默认采样器使用 `dpmpp_2m_sde_gpu` + `beta57` scheduler。`beta57` 调度器来自 [RES4LYF](https://github.com/ClownsharkBatwing/RES4LYF) 节点包，需额外安装。如果未安装，可改用 `beta` 或 `ddim_uniform` 作为替代。

---

## ⚡ 核心依赖：comfyui-skill CLI

**这是整个链路中最重要的组件。** 没有它，AI 编程助手（Snow / Codex）无法与本地 ComfyUI 通信和执行工作流。

| 项目        | 链接                                                                              |
| ----------- | --------------------------------------------------------------------------------- |
| GitHub 仓库 | [HuangYuChuh/ComfyUI_Skill_CLI](https://github.com/HuangYuChuh/ComfyUI_Skill_CLI) |
| PyPI 包     | [comfyui-skill-cli](https://pypi.org/project/comfyui-skill-cli/)                  |

```powershell
pip install comfyui-skill-cli
```

> 安装后，AI 助手可通过 `comfyui-skill` 命令查询模型列表、导入工作流、执行生图和管理队列。**它不仅服务于 Anima，任何 ComfyUI 工作流（如光辉、SDXL、FLUX、修图、视频生成等）都可以通过它统一调度。**

---

## 📦 模型安装

将以下模型文件放入 ComfyUI 的 `models/` 对应目录：

### Checkpoint (UNet)

| 文件                          | 放置路径                                            | 来源                                                                    |
| ----------------------------- | --------------------------------------------------- | ----------------------------------------------------------------------- |
| `anima-base-v1.0.safetensors` | `models/checkpoints/` 或 `models/diffusion_models/` | [HuggingFace - Anima](https://huggingface.co/KBlueLeaf/anima-base-v1.0) |

### CLIP (文本编码器)

| 文件                          | 放置路径                                  |
| ----------------------------- | ----------------------------------------- |
| `qwen_3_06b_base.safetensors` | `models/clip/` 或 `models/text_encoders/` |

### VAE

| 文件                         | 放置路径      |
| ---------------------------- | ------------- |
| `qwen_image_vae.safetensors` | `models/vae/` |

### LoRAs

| 文件                                        | 放置路径        | 来源                                                                                                        |
| ------------------------------------------- | --------------- | ----------------------------------------------------------------------------------------------------------- |
| `anima-highres-aesthetic-boost.safetensors` | `models/loras/` | [CivitAI](https://civitai.red/models/2540444/anima-highresaesthetic-boost)                                  |
| `anima-base-1-masterpiece-v51.safetensors`  | `models/loras/` | [CivitAI](https://civitai.red/models/929497/aesthetic-quality-modifiers-masterpiece?modelVersionId=2961717) |

> 默认工作流使用了上述双 LoRA。模型文件路径或文件名与工作流 JSON 不一致时，需修改 JSON 后重新导入。

---

## 🔌 必需的自定义节点

在 ComfyUI 的 `custom_nodes/` 目录中安装以下节点：

| 节点                        | 用途                                                | 安装地址                                                                                        |
| --------------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| **AnimaBoosterLoader**      | Anima 模型加载器，含 SageAttention 优化             | [BlackSnowSkill/ANIMA_BOOSTER](https://github.com/BlackSnowSkill/ANIMA_BOOSTER)                 |
| **FLS_SamplerV4**           | Foveated Latent Sampling 高级采样器，提升细节清晰度 | [BlackSnowSkill/ComfyUI-BSS_FLSampler](https://github.com/BlackSnowSkill/ComfyUI-BSS_FLSampler) |
| **AnimaTeaCache**           | TeaCache 缓存加速，减少推理时间                     | [ComfyUI-TeaCache](https://github.com/daraskme/comfy_anima_tea_cache)                           |
| **AnimaArtistPack**         | 画师多风格融合（仅 artist mixer 工作流需要）        | 同 ANIMA_BOOSTER 包                                                                             |
| **AnimaArtistCrossAttn**    | 画师跨注意力混合（仅 artist mixer 工作流需要）      | 同 ANIMA_BOOSTER 包                                                                             |
| **RES4LYF**                 | 提供 `beta57` 调度器，默认工作流依赖此节点          | [ClownsharkBatwing/RES4LYF](https://github.com/ClownsharkBatwing/RES4LYF)                       |
| **RTXVideoSuperResolution** | NVIDIA RTX VSR 2x 放大，仅 NVIDIA RTX 显卡可用      | [Comfy-Org/Nvidia_RTX_Nodes_ComfyUI](https://github.com/Comfy-Org/Nvidia_RTX_Nodes_ComfyUI)     |

### 安装方式

**方式一：使用 ComfyUI Manager（推荐）**

```bash
# 在 ComfyUI Manager 中搜索以下关键词安装：
# "ANIMA BOOSTER" / "FLSampler" / "TeaCache" / "RES4LYF" / "RTX"
```

**方式二：手动克隆**

```powershell
cd ComfyUI/custom_nodes
git clone https://github.com/BlackSnowSkill/ANIMA_BOOSTER.git
git clone https://github.com/BlackSnowSkill/ComfyUI-BSS_FLSampler.git
git clone https://github.com/daraskme/comfy_anima_tea_cache.git
git clone https://github.com/ClownsharkBatwing/RES4LYF.git
git clone https://github.com/Comfy-Org/Nvidia_RTX_Nodes_ComfyUI.git
```

> 安装后重启 ComfyUI，使用 `comfyui-skill deps check local/anima-txt2img-aesthetic-lora` 验证节点完整性。

---

## ⚙️ 快速开始

### 1. 安装 ComfyUI 和 comfyui-skill CLI

```powershell
git clone https://github.com/comfyanonymous/ComfyUI
cd ComfyUI
pip install comfyui-skill-cli
```

### 2. 放置模型和节点

按上方表格将模型文件放入对应目录，克隆自定义节点，然后启动 ComfyUI。

### 3. 导入工作流

```powershell
cd comfyui-good-anima/comfyui-manager/workspace
comfyui-skill workflow import ../data/anima-txt2img-aesthetic-lora.json --check-deps --json
```

### 4. 执行生图

```powershell
cd comfyui-good-anima/comfyui-manager/workspace
node run_workflow_args.js run local/anima-txt2img-aesthetic-lora .\args_anima.json
```

---

## 🐍 Python 脚本说明

`danbooru-tags/` 目录中包含以下 Python 脚本，**仅用于首次初始化标签索引**，日常生图不需要运行：

| 脚本              | 作用                                            | 运行时机                 |
| ----------------- | ----------------------------------------------- | ------------------------ |
| `build_index.py`  | 读取 `anima-1.0.csv` 构建 `tags_index.json`     | 首次克隆后 or CSV 更新后 |
| `sqlite_index.py` | 读取 `tags_index.json` 构建 `tags_index.sqlite` | `build_index.py` 之后    |
| `tag_groups.py`   | 标签分组定义，被上述脚本引用                    | 无需单独运行             |

**首次初始化：**

```powershell
cd comfyui-good-anima/danbooru-tags
python build_index.py
python sqlite_index.py
```

> 仓库已包含预构建的 `tags_index.sqlite` 和 `tags_index.json`，大多数情况下跳过此步也可直接使用。

---

## 🦀 Rust CLI 说明

`danbooru-tags/bin/danbooru-tags.exe` 是本项目的核心标签检索工具，**已预编译为 Windows 可执行文件**，无需安装 Rust 或编译即可使用。

- ✅ **直接使用** — `.exe` 已包含在 `bin/` 目录，clone 后立即可用
- ✅ **无需安装 Rust** — 除非你想修改源码或编译其他平台版本
- ❌ **`rust-cli/` 源码** — 本仓库未包含 Rust 源码目录，如需源码请单独联系

---

## 🧠 工作流程

```
用户需求 → anima-composition-director（构图规划）
         → danbooru-tags（标签检索校验）
         → comfyui-animatool（Prompt 组装）
         → comfyui-manager（工作流执行）
```

### 随机图 / Roll 图 / 抽卡

```
用户需求 → anima-composition-director（视觉简报）
         → danbooru-tags --random（随机候选）
         → anima-random-gen（参数产出）
         → comfyui-manager（执行）
```

---

## 🔧 工作流说明

| 工作流 ID                                   | 用途                          | LoRA                                |
| ------------------------------------------- | ----------------------------- | ----------------------------------- |
| `anima-txt2img-aesthetic-lora`              | **默认生图**                  | 双美学 LoRA + TeaCache + RTX VSR 2x |
| `anima-txt2img-base`                        | 基础版（无 LoRA，对比测试用） | 无                                  |
| `anima-txt2img-aesthetic-lora-enhancer`     | 增强版                        | 美学 LoRA + 增强节点                |
| `anima-txt2img-aesthetic-lora-fixed`        | 固定参数版                    | 双美学 LoRA                         |
| `anima-txt2img-aesthetic-lora-artist-mixer` | **画师融合**                  | 双美学 LoRA + AnimaArtistMixer      |

---

## 🗂️ 完整项目结构

```
comfyui-good-anima/
│
├── README.md                               # 本文件
├── LICENSE                                 # MIT 许可证
├── .gitignore                              # Git 忽略规则
│
├── anima-composition-director/             # 🎬 构图指导
│   ├── SKILL.md
│   └── agents/openai.yaml
│
├── anima-random-gen/                       # 🎲 随机图生成
│   └── SKILL.md
│
├── comfyui-animatool/                      # 🔧 生图入口
│   └── SKILL.md
│
├── comfyui-manager/                        # ⚡ ComfyUI 管理器
│   ├── SKILL.md
│   └── workspace/
│       ├── config.json                     # ComfyUI 服务器配置
│       ├── data/                           # 工作流 JSON 定义
│       │   ├── anima-txt2img-base.json
│       │   ├── anima-txt2img-aesthetic-lora.json
│       │   ├── anima-txt2img-aesthetic-lora-enhancer.json
│       │   ├── anima-txt2img-aesthetic-lora-fixed.json
│       │   ├── anima-txt2img-aesthetic-lora-artist-mixer.json
│       │   └── local/                      # 已导入的工作流映射
│       ├── cache_anima_outputs.js
│       └── run_workflow_args.js
│
└── danbooru-tags/                          # 🏷️ 标签检索器
    ├── SKILL.md
    ├── bin/danbooru-tags.exe               # Rust CLI（预编译，无需编译）
    ├── anima-1.0.csv                       # Anima 标签主索引
    ├── tags_index.sqlite                   # SQLite 索引（预构建）
    ├── tags_index.json                     # JSON 索引（预构建）
    ├── build_index.py                      # 索引构建（仅初始化运行）
    ├── sqlite_index.py                     # SQLite 索引构建
    ├── tag_groups.py                       # 标签分组定义
    ├── artists_extended.txt                # 扩展画师列表
    └── banned_tags.csv                     # 禁用标签列表
```

---

## 📚 参考链接

- [Anima base v1.0 - HuggingFace](https://huggingface.co/KBlueLeaf/anima-base-v1.0)
- [ComfyUI](https://github.com/comfyanonymous/ComfyUI)
- [ANIMA_BOOSTER (AnimaBoosterLoader)](https://github.com/BlackSnowSkill/ANIMA_BOOSTER)
- [ComfyUI-BSS_FLSampler (FLS_SamplerV4)](https://github.com/BlackSnowSkill/ComfyUI-BSS_FLSampler)
- [ComfyUI-TeaCache](https://github.com/daraskme/comfy_anima_tea_cache)
- [NVIDIA RTX Nodes (RTX VSR)](https://github.com/Comfy-Org/Nvidia_RTX_Nodes_ComfyUI)
- [Danbooru](https://danbooru.donmai.us/)

---

## 📄 许可证

GNU General Public License v3.0

本项目基于 GPLv3 开源。这意味着任何人可以自由使用、修改和分发本项目的代码，但**修改后的版本也必须以 GPLv3 开源**，不得闭源商用。详情请参阅 [LICENSE](./LICENSE) 文件。

---

## 🙏 致谢

### 核心组件

特别感谢 [**HuangYuChuh**](https://github.com/HuangYuChuh) 开发的 [ComfyUI_Skill_CLI](https://github.com/HuangYuChuh/ComfyUI_Skill_CLI)。

这个 CLI 工具是本项目能够运转的核心基石。它提供了一套优雅简洁的命令行接口，让 AI 编程助手无需直接处理 ComfyUI 的 HTTP API 调用、无需手动拼接 prompt JSON、无需操心队列管理和模型路径适配，就能像操作本地工具一样自然地与 ComfyUI 交互。没有这个项目，我们的 AI Agent Skills 就无法落地执行，整个工作流也就失去了最后一环。

### 节点与加速

感谢 [**BlackSnowSkill**](https://github.com/BlackSnowSkill) 开发的 [ANIMA_BOOSTER](https://github.com/BlackSnowSkill/ANIMA_BOOSTER) 和 [ComfyUI-BSS_FLSampler](https://github.com/BlackSnowSkill/ComfyUI-BSS_FLSampler)。ANIMA_BOOSTER 提供了 AnimaBoosterLoader 节点，让模型加载与 Sage Attention 加速成为可能；它的 AnimaArtistPack 和 AnimaArtistCrossAttn 节点更是画师多风格融合的关键。FLSampler 则为采样过程带来了 Foveated Latent Sampling 技术，在提升细节清晰度的同时对模型进行二次增噪和加速优化。没有这些节点，Anima 模型的潜力就无法被充分释放。

感谢 [**Comfy-Org**](https://github.com/Comfy-Org) 维护的 [Nvidia_RTX_Nodes_ComfyUI](https://github.com/Comfy-Org/Nvidia_RTX_Nodes_ComfyUI)（老黄的 RTX VSR 节点）。它让图片放大变得极快且高质量，在保持画质的同时大幅缩短了放大耗时，是出图流程中不可或缺的一环。

### 模型与 LoRA

感谢 [**KBlueLeaf**](https://huggingface.co/KBlueLeaf) 及 Anima 团队训练的 Anima base v1.0 模型。Anima 为二次元 AI 生图领域带来了一颗升起的新星，它在角色一致性、画风还原和构图理解上的出色表现，让本地 AI 绘图达到了前所未有的高度。没有这个模型的诞生，整个 ComfyUI 二次元生图生态都会缺少最重要的一块拼图，也自然不会有本项目的存在。感谢团队在 DiT 架构和 Danbooru 标签系统上的深耕，为社区提供了一个真正可用、可控、可本地部署的二次元生成模型。

感谢 [**CivitAI**](https://civitai.com) 社区贡献的 LoRA 模型作者们：

- [anima-highres-aesthetic-boost](https://civitai.red/models/2540444/anima-highresaesthetic-boost) — 高分辨率下的美学增强，让细节更加丰富自然
- [aesthetic-quality-modifiers-masterpiece](https://civitai.red/models/929497/aesthetic-quality-modifiers-masterpiece?modelVersionId=2961717) — 杰作品质修饰器，让整体画面完成度大幅提升

这两款美学 LoRA 是让 Anima 生图从"能看"走向"完善"的关键，没有它们，输出的画面质感和完成度都会大打折扣。

### 调度器

感谢 [**ClownsharkBatwing**](https://github.com/ClownsharkBatwing) 的 [RES4LYF](https://github.com/ClownsharkBatwing/RES4LYF) 节点包提供的 `beta57` 调度器，为本项目的默认采样配置提供了稳定且高质量的选择。

衷心感谢以上所有开源作者和社区贡献者为 AI 创作生态做出的贡献。 ❤️
