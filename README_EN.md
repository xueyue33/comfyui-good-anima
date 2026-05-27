# ComfyUI Good Anima 🎨

> A collection of AI Agent Skills for ComfyUI + Anima anime-style image generation.

---

## 📋 Overview

**ComfyUI Good Anima** is a set of AI Agent Skills designed for the **Anima anime-style image generation model** with **ComfyUI**. These structured Skill files guide AI coding assistants through the complete image generation pipeline:

1. 🎬 **Composition Planning** — Choose canvas, camera, composition, and lighting based on semantic description
2. 🔍 **Tag Retrieval** — Search and validate character, artist, clothing anchors via the Danbooru tag index
3. 🔧 **Prompt Assembly** — Build compliant positive/negative prompts following Anima's official spec
4. ⚡ **Workflow Execution** — Invoke ComfyUI workflows for generation, upscaling, and caching

### Compatible AI Coding Assistants

These Skills are designed for **AI Coding Agents** that can execute shell commands:

| Assistant              | Status          | Notes                                                                         |
| ---------------------- | --------------- | ----------------------------------------------------------------------------- |
| **🟢 Snow**            | ✅ Full Support | **Recommended for Chinese users** — native Skills system support, plug & play |
| **🟢 Claude Code**     | ✅ Full Support | Anthropic official CLI with shell execution                                   |
| **🟢 Codex**           | ✅ Full Support | Full-featured AI coding agent, fully compatible                               |
| **🟢 PI**              | ✅ Full Support | Lightweight AI coding agent, Skills system support                            |
| **🟢 OpenClaw**        | ✅ Supported    | Works with ComfyUI_Skill_CLI integrated agents                                |
| **🟡 Other AI Agents** | ✅ Full Support | Any agent capable of PowerShell/Shell commands                                |

> 💡 **Recommended: [Snow](https://snowcli.com/docs) — the best AI coding agent experience in China**, with native Skills system support, ComfyUI integration, and Chinese language optimization.

### Included Skills

```
comfyui-good-anima/
├── anima-composition-director/    # Composition planning — canvas/camera/composition/lighting
├── anima-random-gen/              # Random generation — random artists/tags/parameters
├── comfyui-animatool/            # Generation entry — prompt assembly & parameter strategy
├── comfyui-manager/              # ComfyUI manager — workflow execution & model management
└── danbooru-tags/                # 🔍 Tag retriever — see details below
```

### 🔍 What is danbooru-tags and why is it needed?

**danbooru-tags** is the core retrieval infrastructure of this project. It's a Rust CLI tool that performs high-speed searches and anchor validation against the **official Anima tag index (anima-1.0.csv)**.

#### Problems it solves

Anima is trained on the Danbooru tagging system — precise control requires using **valid Danbooru tags**. With millions of tags, manual memorization is impossible. danbooru-tags solves:

| Problem               | Without danbooru-tags                                             | With danbooru-tags                                              |
| --------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------- |
| **Artist validation** | "Use rella style" → AI doesn't know if `@rella` is valid          | `--group artist --prefix "@rella"` returns confirmed artist     |
| **Character lookup**  | "立华奏" in Danbooru is `kanade tachibana` — AI might guess wrong | `--group character --keyword "kanade tachibana"` hits precisely |
| **Tag accuracy**      | "巫女服" is not a valid Danbooru tag                              | Decompose into `miko`, `hakama`, `wide sleeves` candidates      |
| **Random selection**  | Can't randomly pick from valid tags                               | `--random 5 --for-prompt` provides usable random artists        |
| **Batch queries**     | One query per tag, slow and inefficient                           | `--batch-file` handles 12-16 queries at once, 8 threads         |

#### How it works

```
anima-1.0.csv (official index)
       ↓
 build_index.py + sqlite_index.py (build index)
       ↓
tags_index.sqlite (fast local index)
       ↓
 bin/danbooru-tags.exe (Rust CLI)
       ↓
 AI agent queries via --group / --random / --batch-file
 obtains confirmed_tags / candidate_tags for prompt assembly
```

#### Is it essential?

**Yes.** Without danbooru-tags, the AI agent cannot verify artist names, check character tag spelling, or ensure randomly selected tags are within Anima's comprehension. The entire generation pipeline becomes "blind prompting, gambling on outputs" — losing all precision control.

---

## 🖼️ Sample Gallery

Example images generated with ComfyUI Good Anima + Anima base v1.0 (artist: rella):

| Image                                                                                      | Description                                                               |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| ![Komachi & Eiki](samples/anima_base_v1_0-rella-flw-onozuka_komachi_shiki_eiki_00001_.png) | Touhou Project — Onozuka Komachi & Shiki Eiki, Flower Viewing theme       |
| ![Yoshika & Seiga](samples/anima_base_v1_0-rella-inc-miyako_yoshika_kaku_seiga_00001_.png) | Touhou Project — Miyako Yoshika & Kaku Seiga, Ten Desires theme           |
| ![Yukari & Ran](samples/anima_base_v1_0-rella-pcb-yakumo_yukari_ran_yakumo_00001_.png)     | Touhou Project — Yakumo Yukari & Yakumo Ran, Perfect Cherry Blossom theme |

---

## 🖥️ System Requirements

| Dependency            | Version              | Notes                                                        |
| --------------------- | -------------------- | ------------------------------------------------------------ |
| **OS**                | Windows 10/11        | PowerShell 5.x+, uses Windows PowerShell syntax              |
| **ComfyUI**           | Latest               | Image generation backend                                     |
| **comfyui-skill-cli** | Latest               | ⚠️ **Core dependency — bridge between AI agent and ComfyUI** |
| **Node.js**           | 18+                  | For workflow execution scripts                               |
| **Python**            | 3.10+                | Only for tag index initialization, not needed for daily use  |
| **NVIDIA GPU**        | 8GB+ VRAM            | 12GB+ recommended, for Anima inference and RTX VSR upscaling |
| **CUDA**              | 12.8+                | GPU acceleration required                                    |
| **PyTorch**           | CUDA 12.8 compatible | Use with xformers 0.0.3.0                                    |
| **xformers**          | 0.0.3.0              | Memory optimization                                          |

### ComfyUI Startup Recommendation

Enable Sage Attention mode for best performance (requires ANIMA_BOOSTER):

```powershell
python main.py --use-sage-attention
```

Or add `--use-sage-attention` to ComfyUI startup parameters. The AnimaBoosterLoader node can also set `sage_attention` to `enabled`.

> **Note:** Default sampler uses `dpmpp_2m_sde_gpu` + `beta57` scheduler. `beta57` comes from the [RES4LYF](https://github.com/ClownsharkBatwing/RES4LYF) node pack — install it separately. Alternatives: `beta` or `ddim_uniform`.

---

## ⚡ Core Dependency: comfyui-skill CLI

**The most important component in the entire pipeline.** Without it, AI coding assistants (Snow / Codex) cannot communicate with local ComfyUI or execute workflows.

| Project      | Link                                                                              |
| ------------ | --------------------------------------------------------------------------------- |
| GitHub Repo  | [HuangYuChuh/ComfyUI_Skill_CLI](https://github.com/HuangYuChuh/ComfyUI_Skill_CLI) |
| PyPI Package | [comfyui-skill-cli](https://pypi.org/project/comfyui-skill-cli/)                  |

```powershell
pip install comfyui-skill-cli
```

> After installation, the AI agent can use the `comfyui-skill` command to list models, import workflows, generate images, and manage queues. **It's not limited to Anima — any ComfyUI workflow (Guanghui, SDXL, FLUX, image editing, video generation, etc.) can be orchestrated through it.**

---

## 📦 Model Installation

Place the following model files in ComfyUI's `models/` directory:

### Checkpoint (UNet)

| File                          | Location                                            | Source                                                                  |
| ----------------------------- | --------------------------------------------------- | ----------------------------------------------------------------------- |
| `anima-base-v1.0.safetensors` | `models/checkpoints/` or `models/diffusion_models/` | [HuggingFace - Anima](https://huggingface.co/KBlueLeaf/anima-base-v1.0) |

### CLIP (Text Encoder)

| File                          | Location                                  |
| ----------------------------- | ----------------------------------------- |
| `qwen_3_06b_base.safetensors` | `models/clip/` or `models/text_encoders/` |

### VAE

| File                         | Location      |
| ---------------------------- | ------------- |
| `qwen_image_vae.safetensors` | `models/vae/` |

### LoRAs

| File                                        | Location        | Source                                                                                                      |
| ------------------------------------------- | --------------- | ----------------------------------------------------------------------------------------------------------- |
| `anima-highres-aesthetic-boost.safetensors` | `models/loras/` | [CivitAI](https://civitai.red/models/2540444/anima-highresaesthetic-boost)                                  |
| `anima-base-1-masterpiece-v51.safetensors`  | `models/loras/` | [CivitAI](https://civitai.red/models/929497/aesthetic-quality-modifiers-masterpiece?modelVersionId=2961717) |

> The default workflow uses both LoRAs. If file paths differ from workflow JSON, modify the JSON and re-import.

---

## 🔌 Required Custom Nodes

Install the following nodes in ComfyUI's `custom_nodes/` directory:

| Node                        | Purpose                                                                 | Install Location                                                                                |
| --------------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| **AnimaBoosterLoader**      | Anima model loader with SageAttention                                   | [BlackSnowSkill/ANIMA_BOOSTER](https://github.com/BlackSnowSkill/ANIMA_BOOSTER)                 |
| **FLS_SamplerV4**           | Foveated Latent Sampling for enhanced detail                            | [BlackSnowSkill/ComfyUI-BSS_FLSampler](https://github.com/BlackSnowSkill/ComfyUI-BSS_FLSampler) |
| **AnimaTeaCache**           | TeaCache acceleration                                                   | [ComfyUI-TeaCache](https://github.com/daraskme/comfy_anima_tea_cache)                           |
| **AnimaArtistPack**         | Multi-artist fusion (artist mixer only)                                 | Included in ANIMA_BOOSTER                                                                       |
| **AnimaArtistCrossAttn**    | Cross-attention artist mixing (artist mixer only)                       | Included in ANIMA_BOOSTER                                                                       |
| **RES4LYF**                 | ⚠️ **Required — provides `beta57` scheduler, used by default workflow** | [ClownsharkBatwing/RES4LYF](https://github.com/ClownsharkBatwing/RES4LYF)                       |
| **RTXVideoSuperResolution** | NVIDIA RTX VSR 2x upscaling (NVIDIA GPUs only)                          | [Comfy-Org/Nvidia_RTX_Nodes_ComfyUI](https://github.com/Comfy-Org/Nvidia_RTX_Nodes_ComfyUI)     |

### Installation Methods

**Method 1: Via ComfyUI Manager (recommended)**

Search for: `"ANIMA BOOSTER" / "FLSampler" / "TeaCache" / "RES4LYF" / "RTX"`

**Method 2: Manual clone**

```powershell
cd ComfyUI/custom_nodes
git clone https://github.com/BlackSnowSkill/ANIMA_BOOSTER.git
git clone https://github.com/BlackSnowSkill/ComfyUI-BSS_FLSampler.git
git clone https://github.com/daraskme/comfy_anima_tea_cache.git
git clone https://github.com/ClownsharkBatwing/RES4LYF.git
git clone https://github.com/Comfy-Org/Nvidia_RTX_Nodes_ComfyUI.git
```

> After installation, restart ComfyUI and verify with `comfyui-skill deps check local/anima-txt2img-aesthetic-lora`.

---

## ⚙️ Quick Start

### 1. Install ComfyUI and comfyui-skill CLI

```powershell
git clone https://github.com/comfyanonymous/ComfyUI
cd ComfyUI
pip install comfyui-skill-cli
```

### 2. Place models and nodes

Place model files and clone custom nodes per the tables above, then start ComfyUI.

### 3. Import workflow

```powershell
cd comfyui-good-anima/comfyui-manager/workspace
comfyui-skill workflow import ../data/anima-txt2img-aesthetic-lora.json --check-deps --json
```

### 4. Generate an image

```powershell
cd comfyui-good-anima/comfyui-manager/workspace
node run_workflow_args.js run local/anima-txt2img-aesthetic-lora .\args_anima.json
```

---

## 🧠 Workflow

```
User request → anima-composition-director (composition plan)
             → danbooru-tags (tag validation)
             → comfyui-animatool (prompt assembly)
             → comfyui-manager (workflow execution)
```

### Random / Roll Generation

```
User request → anima-composition-director (visual brief)
             → danbooru-tags --random (random candidates)
             → anima-random-gen (parameter generation)
             → comfyui-manager (execution)
```

---

## 🔧 Available Workflows

| Workflow ID                                 | Purpose                         | LoRA                                        |
| ------------------------------------------- | ------------------------------- | ------------------------------------------- |
| `anima-txt2img-aesthetic-lora`              | **Default generation**          | Dual aesthetic LoRA + TeaCache + RTX VSR 2x |
| `anima-txt2img-base`                        | Base version (no LoRA, testing) | None                                        |
| `anima-txt2img-aesthetic-lora-enhancer`     | Enhanced                        | Aesthetic LoRA + enhancer nodes             |
| `anima-txt2img-aesthetic-lora-fixed`        | Fixed parameters                | Dual aesthetic LoRA                         |
| `anima-txt2img-aesthetic-lora-artist-mixer` | **Artist fusion**               | Dual aesthetic LoRA + AnimaArtistMixer      |

---

## 🐍 Python Scripts (danbooru-tags)

These scripts in `danbooru-tags/` are **only needed for initial tag index setup**, not for daily use:

| Script            | Purpose                                            | When to Run                 |
| ----------------- | -------------------------------------------------- | --------------------------- |
| `build_index.py`  | Read `anima-1.0.csv` → build `tags_index.json`     | After cloning or CSV update |
| `sqlite_index.py` | Read `tags_index.json` → build `tags_index.sqlite` | After build_index.py        |
| `tag_groups.py`   | Tag group definitions (imported by above scripts)  | No manual run needed        |

**First-time initialization:**

```powershell
cd comfyui-good-anima/danbooru-tags
python build_index.py
python sqlite_index.py
```

> Pre-built `tags_index.sqlite` and `tags_index.json` are included in the repo. Most users can skip this step.

---

## 🦀 Rust CLI (danbooru-tags)

The `danbooru-tags/bin/danbooru-tags.exe` is the core tag retrieval tool, **pre-compiled for Windows** — no Rust installation or compilation needed.

- ✅ **Ready to use** — `.exe` included in `bin/`, works immediately after clone
- ✅ **No Rust needed** — unless you want to modify the source or compile for other platforms
- ❌ **`rust-cli/` source** — not included in this repo; contact us separately if needed

---

## 🗂️ Project Structure

```
comfyui-good-anima/
│
├── README.md                               # This file (中文)
├── README_EN.md                            # English version
├── LICENSE                                 # MIT License
├── .gitignore                              # Git ignore rules
│
├── samples/                                # 🖼️ Sample images
│
├── anima-composition-director/             # 🎬 Composition planning
│   ├── SKILL.md
│   └── agents/openai.yaml
│
├── anima-random-gen/                       # 🎲 Random generation
│   └── SKILL.md
│
├── comfyui-animatool/                      # 🔧 Generation entry
│   └── SKILL.md
│
├── comfyui-manager/                        # ⚡ ComfyUI manager
│   ├── SKILL.md
│   └── workspace/
│       ├── config.json
│       ├── data/                           # Workflow JSON definitions
│       ├── cache_anima_outputs.js
│       └── run_workflow_args.js
│
└── danbooru-tags/                          # 🏷️ Tag retriever
    ├── SKILL.md
    ├── bin/danbooru-tags.exe               # Rust CLI (pre-compiled)
    ├── anima-1.0.csv                       # Main tag index
    ├── tags_index.sqlite                   # SQLite index (pre-built)
    ├── tags_index.json                     # JSON index (pre-built)
    ├── build_index.py / sqlite_index.py / tag_groups.py
    ├── artists_extended.txt
    └── banned_tags.csv
```

---

## 📚 References

- [Anima base v1.0 - HuggingFace](https://huggingface.co/KBlueLeaf/anima-base-v1.0)
- [ComfyUI](https://github.com/comfyanonymous/ComfyUI)
- [ANIMA_BOOSTER (AnimaBoosterLoader)](https://github.com/BlackSnowSkill/ANIMA_BOOSTER)
- [ComfyUI-BSS_FLSampler (FLS_SamplerV4)](https://github.com/BlackSnowSkill/ComfyUI-BSS_FLSampler)
- [ComfyUI-TeaCache](https://github.com/daraskme/comfy_anima_tea_cache)
- [RES4LYF (beta57 scheduler)](https://github.com/ClownsharkBatwing/RES4LYF)
- [NVIDIA RTX Nodes (RTX VSR)](https://github.com/Comfy-Org/Nvidia_RTX_Nodes_ComfyUI)
- [Snow CLI](https://snowcli.com/docs)

---

## 📄 License

GNU General Public License v3.0

This project is open-sourced under GPLv3. Anyone may freely use, modify, and distribute the code, but **modified versions must also be open-sourced under GPLv3** — closed-source commercial use is not permitted. See [LICENSE](./LICENSE) for details.

---

## 🙏 Acknowledgments

### Core Component

Special thanks to [**HuangYuChuh**](https://github.com/HuangYuChuh) for [ComfyUI_Skill_CLI](https://github.com/HuangYuChuh/ComfyUI_Skill_CLI). This CLI is the foundation of the entire pipeline — it provides an elegant command-line interface that lets AI coding assistants interact with ComfyUI naturally, without dealing with HTTP API calls, manual prompt JSON construction, queue management, or model path configuration. Without this project, our AI Agent Skills would not be executable.

### Nodes & Acceleration

Thanks to [**BlackSnowSkill**](https://github.com/BlackSnowSkill) for [ANIMA_BOOSTER](https://github.com/BlackSnowSkill/ANIMA_BOOSTER) and [ComfyUI-BSS_FLSampler](https://github.com/BlackSnowSkill/ComfyUI-BSS_FLSampler). ANIMA_BOOSTER provides the AnimaBoosterLoader for model loading and Sage Attention acceleration, plus AnimaArtistPack/AnimaArtistCrossAttn for multi-artist fusion. FLSampler brings Foveated Latent Sampling for enhanced detail with noise injection and acceleration. Without these nodes, Anima's potential cannot be fully realized.

Thanks to [**Comfy-Org**](https://github.com/Comfy-Org) for [Nvidia_RTX_Nodes_ComfyUI](https://github.com/Comfy-Org/Nvidia_RTX_Nodes_ComfyUI) (the RTX VSR node). It makes image upscaling extremely fast while maintaining quality — an indispensable part of the generation pipeline.

### Model & LoRAs

Thanks to [**KBlueLeaf**](https://huggingface.co/KBlueLeaf) and the Anima team for the Anima base v1.0 model. Anima is a rising star in the AI anime image generation landscape — its outstanding performance in character consistency, art style fidelity, and composition understanding has brought local AI illustration to an unprecedented level. Without this model, the entire ComfyUI anime generation ecosystem would be missing its most important piece.

Thanks to the [**CivitAI**](https://civitai.com) community LoRA authors:

- [anima-highres-aesthetic-boost](https://civitai.red/models/2540444/anima-highresaesthetic-boost) — High-resolution aesthetic enhancement
- [aesthetic-quality-modifiers-masterpiece](https://civitai.red/models/929497/aesthetic-quality-modifiers-masterpiece?modelVersionId=2961717) — Masterpiece quality modifier

These two aesthetic LoRAs are the key to elevating Anima outputs from "passable" to "polished" — without them, image quality and completion would be significantly diminished.

### Scheduler

Thanks to [**ClownsharkBatwing**](https://github.com/ClownsharkBatwing) for the [RES4LYF](https://github.com/ClownsharkBatwing/RES4LYF) node pack providing the `beta57` scheduler, which offers a stable, high-quality default sampling configuration for this project.

❤️ Heartfelt thanks to all open-source authors and community contributors for their contributions to the AI creative ecosystem.
