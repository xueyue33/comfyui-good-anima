---
name: comfyui-manager
description: Manage ComfyUI server, models, workflows, LoRAs, queues, dependencies and CLI workflow execution via comfyui-skill. Execute imported Anima workflows and return local_path results.
---

# ComfyUI Manager — CLI Skill

## 与本 skill 的关系定位

**使用原则**：

- Anima prompt、tag、画布、steps、批量意图由 `comfyui-animatool` 决定。
- 本 skill 只执行已确定 args，并管理服务器、模型、workflow、队列、依赖、日志和 history。
- 管理/运维/查询/非 Anima workflow 执行任务直接走本 skill。

## CLI 工作区

所有 `comfyui-skill` 命令必须从解析出的 `WORKSPACE` 目录运行。`WORKSPACE` 是包含 `config.json` 和 `data/` 的 `comfyui-manager/workspace` 目录。

路径解析规则：

1. 优先使用当前已安装 skill 同目录下的 `workspace`。
2. 已在 `workspace` 目录内执行时，直接使用当前目录。
3. 自动化脚本可显式设置 `COMFYUI_MANAGER_WORKSPACE`。
4. 从通用 Agent Skills 安装环境启动时，可从当前目录向上查找任意 `skills/` 容器，再定位 `comfyui-manager`。
5. 不要写死用户名或任何 agent 平台安装目录。

PowerShell 兜底解析示例：

```powershell
function Test-ComfyManagerWorkspace($Path) {
  return (Test-Path (Join-Path $Path "config.json")) -and (Test-Path (Join-Path $Path "data"))
}

function Find-ComfyManagerWorkspaceFromSkills($Start) {
  $cursor = (Resolve-Path $Start).Path
  while ($cursor) {
    $skillsDirs = Get-ChildItem -LiteralPath $cursor -Directory -Recurse -Depth 2 -Filter "skills" -ErrorAction SilentlyContinue
    foreach ($skillsDir in $skillsDirs) {
      foreach ($candidate in @(
        (Join-Path $skillsDir.FullName "comfyui-manager\workspace"),
        (Join-Path $skillsDir.FullName "comfyui-good-anima\comfyui-manager\workspace")
      )) {
        if (Test-ComfyManagerWorkspace $candidate) { return (Resolve-Path $candidate).Path }
      }
    }
    $parent = Split-Path $cursor -Parent
    if ($parent -eq $cursor) { break }
    $cursor = $parent
  }
  return $null
}

$WORKSPACE = if ($env:COMFYUI_MANAGER_WORKSPACE) {
  $env:COMFYUI_MANAGER_WORKSPACE
} elseif (Test-ComfyManagerWorkspace ".\workspace") {
  (Resolve-Path ".\workspace").Path
} elseif (Test-ComfyManagerWorkspace ".") {
  (Get-Location).Path
} elseif ($found = Find-ComfyManagerWorkspaceFromSkills ".") {
  $found
} else {
  throw "Set COMFYUI_MANAGER_WORKSPACE or run from a directory that can discover skills/comfyui-manager"
}
```

默认 Anima 生图工作流：

```text
local/anima-txt2img-aesthetic-lora
```

只有用户明确指定基础版、禁用 LoRA、对比测试或排查问题时，才使用：

```text
local/anima-txt2img-base
```

只有用户明确要求画师串、多画师融合、artist mixer 或多画师权重混合时，才使用：

```text
local/anima-txt2img-aesthetic-lora-artist-mixer
```

使用 Artist Mixer 时把画师写入 `artist_chain`，主提示词写入 `prompt_11`，不要在 `prompt_11` 里重复堆叠画师名。普通单画师或未明确要求画师串时不要使用该工作流。

统一命令前缀：

```powershell
comfyui-skill --dir "$WORKSPACE"
```

## PowerShell 与运行产物

写入 args / batch JSON 时默认使用 PowerShell 7 UTF-8 no BOM（`Set-Content -Encoding utf8`）。当前终端不是 PS7 时，用 `pwsh.exe -NoProfile -Command` 启动子进程。只有两种方式都不可用，才退到 PS5 + BOM。禁止不查版本就假设 PS5。

运行产物不要写入 skill 目录。临时 args、批量 args、输出图片、缓存和历史统一放到 `$RUNTIME`：

```powershell
$RUNTIME = if ($env:COMFYUI_MANAGER_RUNTIME_DIR) {
  $env:COMFYUI_MANAGER_RUNTIME_DIR
} elseif ($env:SKILL_RUNTIME_ROOT) {
  Join-Path $env:SKILL_RUNTIME_ROOT "comfyui-manager"
} else {
  $config = Get-Content -LiteralPath (Join-Path $WORKSPACE "config.json") -Raw | ConvertFrom-Json
  $outputDir = $config.servers[0].output_dir
  if ($outputDir) {
    Split-Path ([System.IO.Path]::GetFullPath((Join-Path $WORKSPACE $outputDir))) -Parent
  } else {
    Join-Path (Resolve-Path (Join-Path $WORKSPACE "..\..")).Path "runtime\comfyui-manager"
  }
}
New-Item -ItemType Directory -Force -Path $RUNTIME | Out-Null
```

Runtime 解析优先级：`COMFYUI_MANAGER_RUNTIME_DIR` > `SKILL_RUNTIME_ROOT/comfyui-manager` > `workspace/config.json` 的 `output_dir` 父目录 > workspace 相对 fallback。

`workspace/outputs` 和 `workspace/cache` 可指向 `$RUNTIME/outputs`、`$RUNTIME/cache`，用于 Claw / GUI 读取本地文件路径或 base64。不要在 workspace 内复制第二份图片。

## 常规生图最短路径

常规 Anima 生图只读本节和“Anima 默认工作流执行”即可；只有管理、排障、导入 workflow、查模型时才继续阅读后续章节。

常规 Anima 生图时，`comfyui-animatool` 已负责 tag 校验和 prompt 组装；本 skill 只负责执行已导入工作流。不要在每次生图前重复查 `help`、`templates`、`list`、`schema`、`config.json`、目录结构或 `Get-Command`。

默认直接运行：

```powershell
cd "$WORKSPACE"
node .\run_workflow_args.js run local/anima-txt2img-aesthetic-lora .\args_anima.json
```

只有执行失败时才进入诊断。若失败信息包含 `connection refused`、`timeout`、`8181`、`8188`、`Cannot connect`、`Failed to connect`，先判定为 ComfyUI 未启动或端口不一致：停止枚举 workflow / schema / 模板，让用户启动 ComfyUI 或核对 `workspace/config.json` 的 server URL。

只有在 ComfyUI 已确认在线但工作流仍失败时，才继续诊断。若报错包含 `400`、`Bad Request`、`invalid prompt`、`Prompt outputs failed validation`，跳到“400 Bad Request 诊断”，不要反复枚举 `help`、`templates`、目录结构或随机改 workflow。

## 环境适配检查

首次在新机器、迁移后的 ComfyUI、重装模型目录后使用 Anima 默认工作流前，必须确认工作流引用值与 ComfyUI 扫描结果一致。重点检查：

1. AnimaBoosterLoader 的 `model_name`
2. CLIPLoader 的 `clip_name`
3. VAELoader 的 `vae_name`
4. LoraLoaderModelOnly 的 `lora_name`

检查命令统一使用 `--json` 全局前置：

```powershell
comfyui-skill --json --dir "$WORKSPACE" models list diffusion_models
comfyui-skill --json --dir "$WORKSPACE" models list text_encoders
comfyui-skill --json --dir "$WORKSPACE" models list vae
comfyui-skill --json --dir "$WORKSPACE" models list loras
```

如果工作流 JSON 里的值不在扫描结果中，例如模型实际位于 `split_files\diffusion_models\...` 子目录，需要修正 workflow JSON 后重新导入。只有 `deps check` 明确报告缺失模型时，才按本节处理；不要遇到 400 就先猜模型路径。

## 触发条件

当用户提出以下任何需求时，触发本 skill：

**模型管理**：

- 释放显存、卸载模型、清空 VRAM
- 列出模型、查 checkpoint/LoRA/VAE/ControlNet 有哪些
- 更换模型、切换 LoRA

**工作流管理**：

- 导入工作流、切换工作流、禁用/启用工作流
- 列出现有工作流、查看工作流参数

**ComfyUI 服务器**：

- 查服务器状态、系统统计（RAM/VRAM/版本）
- 添加/删除服务器

**节点查询**：

- 查某些 ComfyUI 节点怎么用
- 搜索节点

**队列管理**：

- 查看队列、清空队列、取消任务

**依赖管理**：

- 检查或安装缺少的节点/模型

**日志查看**：

- 查看 ComfyUI 服务器日志

**执行非 Anima 工作流**：

- 运行 SDXL/FLUX/SD3 等工作流
- 执行图生图、视频生成等

## 全局选项

以下全局选项适用于所有 `comfyui-skill` 命令：

| 选项                | 说明                                                                                   |
| ------------------- | -------------------------------------------------------------------------------------- |
| `--json` / `-j`     | 强制 JSON 结构化输出，AI Agent 解析用                                                  |
| `--dir` / `-d`      | 指定项目数据目录（默认：当前目录）。本 skill 统一使用 `--dir "$WORKSPACE"`             |
| `--server` / `-s`   | 指定服务器 ID（默认：`local`）                                                         |
| `--output-format`   | 输出格式：`text`（终端表格）、`json`（单次 JSON）、`stream-json`（实时 NDJSON 事件流） |
| `--verbose` / `-v`  | 详细输出，用于调试                                                                     |
| `--no-update-check` | 跳过自动更新检查                                                                       |

## 命令速查

### 服务器管理

```powershell
# 查服务器状态
comfyui-skill --json --dir "$WORKSPACE" server status

# 查系统统计（VRAM/RAM/版本）
comfyui-skill --json --dir "$WORKSPACE" server stats

# 列出所有服务器
comfyui-skill --json --dir "$WORKSPACE" server list
```

### 模型管理

```powershell
# 列出所有模型文件夹
comfyui-skill --json --dir "$WORKSPACE" models list

# 列出 checkpoints
comfyui-skill --json --dir "$WORKSPACE" models list checkpoints

# 列出 LoRAs
comfyui-skill --json --dir "$WORKSPACE" models list loras

# 列出 VAEs
comfyui-skill --json --dir "$WORKSPACE" models list vae

# 列出 ControlNet
comfyui-skill --json --dir "$WORKSPACE" models list controlnet

# 列出 UNet / 扩散模型
comfyui-skill --json --dir "$WORKSPACE" models list diffusion_models

# 列出文本编码器
comfyui-skill --json --dir "$WORKSPACE" models list text_encoders

# 释放 GPU 显存（卸载模型）
comfyui-skill --dir "$WORKSPACE" free --models

# 释放缓存
comfyui-skill --dir "$WORKSPACE" free --memory
```

### 工作流管理

```powershell
# 列出所有已导入的工作流
comfyui-skill --json --dir "$WORKSPACE" list

# 查看工作流详情和参数 schema
comfyui-skill --json --dir "$WORKSPACE" info local/workflow_id

# 从 JSON 文件导入工作流
comfyui-skill --json --dir "$WORKSPACE" workflow import "<path-to-workflow.json>" --check-deps

# 启用/禁用工作流
comfyui-skill --json --dir "$WORKSPACE" workflow enable local/workflow_id
comfyui-skill --json --dir "$WORKSPACE" workflow disable local/workflow_id

# 删除工作流
comfyui-skill --json --dir "$WORKSPACE" workflow delete local/workflow_id
```

### 执行工作流

### Anima 默认工作流执行

args 文件格式按“工作流执行参数格式”执行：必须是纯参数对象，不要包裹 workflow 外壳。

`args_anima.json` 示例：

```json
{
  "prompt_11": "...positive...",
  "prompt_12": "...negative...",
  "width": 1024,
  "height": 1536,
  "batch_size": 1,
  "steps": 30,
  "rtx_vsr_quality": "ULTRA",
  "filename_prefix": "anima/%year%-%month%-%day%/anima_base_v1_0-artist_tag-character_tag"
}
```

本节只执行已确认 args；prompt、画布、steps、批量策略由 `comfyui-animatool` 决定。执行清单：

- 默认 workflow：`local/anima-txt2img-aesthetic-lora`
- 画师串 workflow：`local/anima-txt2img-aesthetic-lora-artist-mixer`，仅在 args 已包含 `artist_chain` 且需求明确为融合/混合/artist mixer 时使用；多个 job 分别使用不同 `@artist` 时仍使用默认 workflow
- 基础 workflow：`local/anima-txt2img-base`，仅在用户明确要求基础版、禁用 LoRA、对比测试或排障时使用
- 执行结果读取 `outputs[].local_path`

节点参数护栏：

- 不传 `rtx_vsr_scale`
- FLSampler / TeaCache / AnimaBoosterLoader 参数默认不传
- 如需传 `teacache_version`，只能用 `v1 (Legacy Fast)` 或 `v2 (Standard Precise)`

Anima 输出命名规则：`filename_prefix` 必须使用 `anima/%year%-%month%-%day%/<model_tag>-<artist_tag>-<character_tag>`。`model_tag` 来自 UNet 模型名，去掉扩展名后转安全名，例如 `anima-base-v1.0.safetensors` -> `anima_base_v1_0`；默认工作流的 `artist_tag` 来自 prompt 中的单画师标签，去掉 `@`；Artist Mixer 工作流的 `artist_tag` 来自 `artist_chain`，按主次取 1–3 个画师名拼接。`character_tag` 来自主要角色标签。三者都转小写，并把空格或特殊符号替换成 `_`。ComfyUI 会自动按此前缀保存到 `output/anima/YYYY-MM-DD/`，并追加 `_00001_`、`_00002_` 这样的顺序号；不要手写序号。

Anima 本地缓存规则：每次成功执行 Anima 生图后，除了返回 `outputs[].local_path` 指向的 ComfyUI 正式输出，还必须在 `$RUNTIME/cache/anima/YYYY-MM-DD/` 保留一份本地缓存，供远程 Claw/云端客户端复用，减少重复下载与重复调用。缓存日期必须优先来自输出的 `subfolder` 或 `source_local_path` 中的 `anima/YYYY-MM-DD`，其次才使用本地时区日期；不要用 `new Date().toISOString().slice(0, 10)` 生成缓存日期，UTC 会在中国时区凌晨把缓存写进前一天。缓存内容包括：输出图片副本或硬链接、最终 args JSON、manifest JSON。manifest 至少记录 `workflow_id`、`prompt_id`（如有）、`source_local_path`、`cache_local_path`、`args_path`、`filename_prefix`、`created_at`。如果 `outputs[].local_path` 已经位于缓存目录中，不要重复复制，只写 manifest；否则优先硬链接，失败后再按原文件名复制到缓存目录。缓存失败不应伪装生图失败，但必须在结果中说明缓存失败原因。使用 `cache_anima_outputs.js` 补建缓存时，非默认 Anima workflow 必须传 `--workflow-id <workflow_id>`，与执行时的 workflow id 保持一致。

临时提交脚本要求：凡是生成串行/并行提交脚本，都不能只调用 `comfyui-skill submit` 后结束。脚本必须记录每个 job 的 args 文件和 `prompt_id`，等待任务完成或在任务完成后用 `comfyui-skill --json status <prompt_id>` 读取 `outputs[].local_path`，再执行上述本地缓存规则。不要把 ComfyUI 队列返回的 `prompt_id` 传给 `history show`；`history show` 使用的是 workflow id + run_id。若脚本选择只入队不等待完成，必须同时生成一个后处理脚本或清单，说明如何根据 `prompt_id` 补建 `$RUNTIME/cache/anima/YYYY-MM-DD/` 缓存。远程 GUI / Claw / 云端客户端需要展示图片时，优先读取 runtime 缓存；若 `workspace/cache` 是 junction，也可以通过 workspace 路径读取。

### Anima 批量生图规则

批量策略由 `comfyui-animatool` 决定；本 skill 只执行已确认的 args 和缓存结果。默认仍只出 1 张，只有 `comfyui-animatool` 已确认批量意图时才启用批量执行。

批量分三种，不要混用：

| 需求                             | 执行方式                                                                                 | 适用场景                                             |
| -------------------------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| 同一个 prompt 出 N 张变体        | 设置 `batch_size=N`，只提交 1 个 workflow                                                | 同构图、同角色、同参数，只要不同噪声变体             |
| 同一个 prompt 分几批出           | 提交多个 job，每个 job 可设置 `batch_size`，每个 job 使用不同 `seed` / `filename_prefix` | 想控制“几批”，或避免单次 batch 过大                  |
| 每张图不同 prompt / 不同随机 tag | 每个 prompt 单独构造 args 并 `submit` 一个 job                                           | 多主题、多角色、多套随机 tag、第一张和第二张内容不同 |

执行约束：

- 禁止把临时脚本、辅助脚本或一次性批量提交脚本作为 Anima 批量策略来源；脚本只能读取/提交已经由 `comfyui-animatool` 确认的 args，不得自行决定 prompt、`steps`、画布、模型或 `filename_prefix`。
- 多 prompt 批量推荐用 `submit` 非阻塞入队，再用 `status` / `history` 汇总 `local_path`；不要每张都 `run` 后等待完再组下一张。
- 每个 job 的 `filename_prefix` 必须遵循 `anima/%year%-%month%-%day%/<model_tag>-<artist_tag>-<character_tag>`；同一模型、画师、角色同一天多图时交给 ComfyUI 自动追加 `_00001_`、`_00002_` 顺序号。
- 批量仍使用 `local/anima-txt2img-aesthetic-lora`，除非用户明确指定其他 workflow。
- 批量任务失败时，先报告失败 job 的序号和错误；不要假装整批成功。

同 prompt 单 job 示例：

```json
{
  "prompt_11": "...positive...",
  "prompt_12": "...negative...",
  "width": 1024,
  "height": 1536,
  "batch_size": 4,
  "steps": 30,
  "rtx_vsr_quality": "ULTRA",
  "filename_prefix": "anima/%year%-%month%-%day%/anima_base_v1_0-rhasta-yuudachi_azur_lane"
}
```

多 prompt 队列示例：

```powershell
cd WORKSPACE
$jobs = Get-Content -LiteralPath .\batch_jobs.json -Raw | ConvertFrom-Json
$ids = @()
foreach ($job in $jobs) {
  $argsFile = ".\batch_args\$($job.id).json"
  $job.args | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $argsFile -Encoding utf8
  $result = node .\run_workflow_args.js submit local/anima-txt2img-aesthetic-lora $argsFile | ConvertFrom-Json
  $ids += $result.prompt_id
}
$ids
```

`batch_jobs.json` 结构建议：

```json
[
  {
    "args": {
      "prompt_11": "...prompt A...",
      "prompt_12": "...negative...",
      "width": 1024,
      "height": 1536,
      "batch_size": 1,
      "seed": 101,
      "filename_prefix": "anima/%year%-%month%-%day%/anima_base_v1_0-happoubi_jin-yuudachi_azur_lane"
    }
  },
  {
    "args": {
      "prompt_11": "...prompt B...",
      "prompt_12": "...negative...",
      "width": 1536,
      "height": 1024,
      "batch_size": 1,
      "seed": 102,
      "filename_prefix": "anima/%year%-%month%-%day%/anima_base_v1_0-mignon-yuudachi_azur_lane"
    }
  }
]
```

```powershell
# 阻塞式执行（等待完成，有实时 WebSocket 输出）
cd WORKSPACE && node .\run_workflow_args.js run local/workflow_id .\args.json

# 非阻塞提交（立即返回 prompt_id）
cd WORKSPACE && node .\run_workflow_args.js submit local/workflow_id .\args.json

# 检查执行状态
comfyui-skill --json --dir "$WORKSPACE" status <prompt_id>

# 取消任务
comfyui-skill --json --dir "$WORKSPACE" cancel <prompt_id>

# 用优先级跳跃队列（负数插队）时也继续走 run_workflow_args.js，额外 CLI 参数放在 JSON 文件参数之后。
cd WORKSPACE && node .\run_workflow_args.js run local/workflow_id .\args.json --priority -1
```

### 上传文件（用于 img2img 等）

```powershell
# 上传本地文件
comfyui-skill --json --dir "$WORKSPACE" upload "<path-to-image.png>"

# 链式上传：把上次工作流的输出当输入
comfyui-skill --json --dir "$WORKSPACE" upload --from-output <prompt_id>
```

### 节点查询

```powershell
# 列出所有节点（按类别分组）
comfyui-skill --json --dir "$WORKSPACE" nodes list

# 查看单个节点详情
comfyui-skill --json --dir "$WORKSPACE" nodes info <node_class_name>

# 模糊搜索节点
comfyui-skill --json --dir "$WORKSPACE" nodes search <keyword>
```

### 队列管理

```powershell
# 查看运行中和排队的任务
comfyui-skill --json --dir "$WORKSPACE" queue list

# 清空所有排队的任务（不影响正在运行的）
comfyui-skill --json --dir "$WORKSPACE" queue clear

# 删除特定排队任务
comfyui-skill --json --dir "$WORKSPACE" queue delete <prompt_id>
```

### 依赖管理

```powershell
# 检查工作流缺少的节点/模型
comfyui-skill --json --dir "$WORKSPACE" deps check local/workflow_id

# 自动安装所有缺少的依赖
comfyui-skill --json --dir "$WORKSPACE" deps install local/workflow_id --all
```

### 日志与历史

```powershell
# 查看服务器日志
comfyui-skill --json --dir "$WORKSPACE" logs show

# 查看执行历史
comfyui-skill --json --dir "$WORKSPACE" history list local/workflow_id

# 查看单次执行详情
comfyui-skill --json --dir "$WORKSPACE" history show local/workflow_id <run_id>
```

### 模板与子图

```powershell
# 查看可用工作流模板
comfyui-skill --json --dir "$WORKSPACE" templates list

# 查看可用子图组件
comfyui-skill --json --dir "$WORKSPACE" templates subgraphs
```

### 配置管理

```powershell
# 导出配置和工作流为可迁移包
comfyui-skill --dir "$WORKSPACE" config export --output "<backup.zip>" --json

# 导入配置包
comfyui-skill --dir "$WORKSPACE" config import "<backup.zip>" --json
```

## JSON 输出处理

`--json` 是全局标志，必须放在 `comfyui-skill` 之后、子命令之前。请求时始终使用：

```powershell
comfyui-skill --json --dir "$WORKSPACE" <command>
```

不要把 `--json` 放在命令末尾。正确：`comfyui-skill --json workflow import ...`；错误：`comfyui-skill workflow import ... --json`。

JSON 输出的典型结构：

```json
{
  "success": true,
  "data": { ... },
  "error": null
}
```

错误时 `"success": false`，错误信息在 `"error"` 字段，同时输出到 stderr。

### 输出模式

| 模式            | 用法                               | 说明                                       |
| --------------- | ---------------------------------- | ------------------------------------------ |
| **Text**        | 默认（终端 TTY）                   | Rich 表格和进度条，人类可读                |
| **JSON**        | `--json` 或 `--output-format json` | 单次 JSON 结果，Agent 解析用               |
| **Stream JSON** | `--output-format stream-json`      | 实时 NDJSON 事件流，用于长时间运行的工作流 |

### 错误处理

- 所有错误信息始终输出到 **stderr**，不会污染 stdout 的 JSON 输出
- Agent 应分别捕获 stdout（数据）和 stderr（错误信息）
- 非 0 退出码表示执行失败

## 工作流执行参数格式

⚠️ **args 文件格式**：必须是纯参数对象，不要包裹 `{ "workflow": "...", "args": { ... } }`。`run_workflow_args.js` 已通过命令参数接收 workflow id，args 文件只负责参数本身。本规则是 args 格式的唯一权威说明。

`--args` 参数接受 JSON 字符串。不同工作流有不同的参数 schema。先用 `info` 查看工作流的参数定义：

```powershell
comfyui-skill --json --dir "$WORKSPACE" info local/txt2img
```

然后根据返回的 schema 构造 args：

```powershell
cd WORKSPACE
node .\run_workflow_args.js run local/txt2img .\args.json
```

**Windows PowerShell 注意事项**：

- 推荐把参数写入 JSON 文件，再用 `node .\run_workflow_args.js run|submit <workflow_id> <args_json_file>` 执行。该脚本用 `spawn` 的 argv 数组传参，并会先把 JSON minify，避免 shell 把换行、空格、引号拆成额外 CLI 参数。
- 不推荐在 PowerShell 里使用 `--args="$(Get-Content ...)"`、`--args=$argsJson` 或内联复杂 JSON；转义容易破坏 prompt 中的引号、反斜杠、换行和空格，常见错误是 `Got unexpected extra arguments`。
- `comfyui-skill` 当前没有 `--args-file`，所以不要让 agent 尝试该参数；用本 workspace 的 `run_workflow_args.js` 代替。
- 如果需要 `--priority` 等额外参数，放在 JSON 文件路径之后，例如：`node .\run_workflow_args.js run local/anima-txt2img-aesthetic-lora .\args_anima.json --priority -1`。不要为了额外参数回退到 PowerShell 内联 `--args`。

## 与 comfyui-animatool 协作示例

**场景：用户想换一个 LoRA 然后生成图片**

1. 本 skill 查可用 LoRA → `comfyui-skill --json --dir "$WORKSPACE" models list loras`
2. 告诉用户有哪些 LoRA 可选
3. 当前默认 Anima 工作流的美学 LoRA 是固定节点，不通过普通 args 切换
4. 若要更换 LoRA，复制/编辑工作流或新增暴露 LoRA 参数的 schema，再执行对应 workflow

**场景：显存不够，需要清理**

1. 先查状态 → `comfyui-skill --json --dir "$WORKSPACE" server stats`
2. 释放显存 → `comfyui-skill --dir "$WORKSPACE" free --models`
3. 再确认释放效果 → `comfyui-skill --json --dir "$WORKSPACE" server stats`

**场景：导入并使用新的 FLUX 工作流**

1. 导入 → `comfyui-skill --json --dir "$WORKSPACE" workflow import "<path-to-flux.json>" --check-deps`
2. 查看参数 → `comfyui-skill --json --dir "$WORKSPACE" info local/flux`
3. 运行 → `node .\run_workflow_args.js run local/flux .\args_flux.json`

## 工作流 ID 命名约定

工作流 ID 格式：`<server_id>/<workflow_id>`

- 默认服务器 ID：`local`
- 例如：`local/txt2img`、`local/flux-txt2img`

只用 `<workflow_id>` 时自动使用默认服务器。

### 400 Bad Request 诊断

如果提交工作流返回 `400 Client Error: Bad Request for url: .../prompt`，按以下顺序排查：

1. 对同一 args 跑 `validate`，确认是工作流/args 校验问题还是执行期问题。
2. 跑 `deps check`，确认是否缺节点或模型。
3. 若 `deps check` 不缺依赖，优先检查 args：必须是纯参数对象；`prompt_11`、`prompt_12` 存在；`width/height/batch_size/steps` 是数字；`rtx_vsr_quality` 为 `LOW|MEDIUM|HIGH|ULTRA`。
4. 优先看 ComfyUI 返回的 `node_errors`，常见为 `value_not_in_list`、缺少必填输入或枚举值错误。
5. 只有错误指向模型/CLIP/VAE/LoRA 字段，或 `deps check` 明确返回缺失模型时，才用 `comfyui-skill --json models list <category>` 核对可用文件名，并修正 workflow JSON 后重新导入。

```powershell
comfyui-skill --json --dir "$WORKSPACE" run local/anima-txt2img-aesthetic-lora --validate --args '{...}'
comfyui-skill --json --dir "$WORKSPACE" deps check local/anima-txt2img-aesthetic-lora
```

快速查看详细错误：

```powershell
$wf = Get-Content -LiteralPath "data/local/<workflow_id>/workflow.json" -Raw | ConvertFrom-Json -Depth 100
$body = @{ prompt = $wf; client_id = "debug" } | ConvertTo-Json -Depth 100
try {
  Invoke-RestMethod -Uri "http://127.0.0.1:8188/prompt" -Method POST -Body $body -ContentType "application/json"
} catch {
  Write-Host $_.ErrorDetails.Message
}
```

`node_errors` 会指出节点、字段和值；按它修，不要盲目重试或猜测。

## 常见问题

1. **"No 'config.json' or 'data/' folder found"** → 确保在 WORKSPACE 目录运行命令
2. **Connection refused** → ComfyUI 服务器未启动，先启动 ComfyUI
3. **400 / Bad Request / invalid prompt** → 按“400 Bad Request 诊断”处理
4. **server stats 显示高 VRAM** → 用 `comfyui-skill free --models` 释放
