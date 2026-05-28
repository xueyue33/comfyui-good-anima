---
name: danbooru-tags
description: Search and validate Anima-compatible Danbooru tags, artists, characters, series, appearance, clothing, pose, scene, lighting, and prompt anchors. Use before Anima image generation or when the user only wants tag/random artist lookup.
---

# Danbooru 标签检索

本 skill 是 `comfyui-animatool` 的检索辅助层：确认 Anima 可用的 Danbooru 锚点、画师、角色、作品和视觉要素。本 skill 不决定是否生图。

## 权威边界

- Anima prompt 规则以官方 HuggingFace 模型卡为准。
- 检索数据默认只来自 Anima CSV / 本地索引；不要把外部泛画师表混入默认生图回填。
- 是否生图、如何组 prompt、如何交接执行都属于 `comfyui-animatool`；本 skill 只返回检索结果。
- 角色查询只返回角色 tag、aliases 和 count，不返回外观设定；不要把 aliases 当发色、服装或道具描述。

## 执行入口

默认优先 Rust CLI。必须从当前宿主的本 skill 目录执行，不要从其他 skill 目录找 `bin`。

`DANBOORU_TAGS_DIR` 是包含 `bin/danbooru-tags.exe`、`anima-1.0.csv`、`tags_index.sqlite` 的目录。路径解析规则：

1. 如果本 skill 位于打包目录 `.../skills/comfyui-good-anima/danbooru-tags`，使用该目录。
2. 如果本 skill 作为顶层 skill 安装在 `.../skills/danbooru-tags`，使用该目录。
3. 兼容迁移时，可在当前用户目录下按 `comfyui-good-anima/danbooru-tags`、顶层 `danbooru-tags` 的顺序查找；优先选择同时存在 `bin/danbooru-tags.exe` 和 `tags_index.sqlite` 的目录。
4. 不要写死 `.snow`、`.codex` 或具体用户名路径；必须使用当前已安装 skill 的真实目录，或用 `$env:USERPROFILE` 组合候选路径。

PowerShell 兜底解析示例：

```powershell
$candidates = @(
  (Join-Path $env:USERPROFILE ".snow/skills/comfyui-good-anima/danbooru-tags"),
  (Join-Path $env:USERPROFILE ".codex/skills/comfyui-good-anima/danbooru-tags"),
  (Join-Path $env:USERPROFILE ".snow/skills/danbooru-tags"),
  (Join-Path $env:USERPROFILE ".codex/skills/danbooru-tags")
)
$DANBOORU_TAGS_DIR = $candidates | Where-Object {
  (Test-Path (Join-Path $_ "bin/danbooru-tags.exe")) -and (Test-Path (Join-Path $_ "tags_index.sqlite"))
} | Select-Object -First 1
if (-not $DANBOORU_TAGS_DIR) { throw "No danbooru-tags skill directory found" }
cd "$DANBOORU_TAGS_DIR"
```

示例：

```powershell
.\bin\danbooru-tags.exe --group artist --prefix "@dair" --limit 5 --for-prompt --json --compact
```

生图前多锚点检索优先用批量入口。PowerShell/Codex/Snow 下复杂 batch JSON 必须写入文件，避免内联 JSON 被 shell 拆坏：

```powershell
@'
{
  "queries": [
    {"id": "character", "group": "character", "keyword": "kanade tachibana", "limit": 5},
    {"id": "series", "group": "series", "keyword": "angel beats", "limit": 5},
    {"id": "artist", "group": "artist", "prefix": "@mignon", "limit": 5}
  ]
}
'@ | Set-Content -LiteralPath .\batch_tags.json -Encoding utf8
.\bin\danbooru-tags.exe --batch-workers 8 --batch-file .\batch_tags.json --for-prompt --json --compact
```

> **Shell 版本自适应**：`Set-Content -Encoding utf8` 在 pwsh 7.x 下默认无 BOM；在 PowerShell 5.1 下会写入 UTF-8 BOM（`0xEF 0xBB 0xBF`），导致 Rust CLI 的 JSON 解析器报 `expected value at line 1 column 1`。**每次写 batch JSON 前必须先检测当前 Shell 版本**，按实际环境选择路径：
>
> ```powershell
> # 拼接 JSON 后，按 Shell 版本选择写入方式
> if ($PSVersionTable.PSVersion.Major -ge 7) {
>   # pwsh 7.x：Set-Content 默认无 BOM
>   $batchJson | Set-Content -LiteralPath .\batch_tags.json -Encoding utf8
> } else {
>   # PowerShell 5.x：必须使用无 BOM UTF-8
>   $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
>   [System.IO.File]::WriteAllText("$pwd\batch_tags.json", $batchJson, $utf8NoBom)
> }
> ```

```

```

批量输出按 `results.<id>.confirmed_tags` / `results.<id>.candidate_tags` 读取，`missing` 表示查不到，直接交给 `nltags`。不要把完整 JSON 复述给用户。

`--batch-file` 文件必须是 JSON 对象，包含 `queries` 数组；每条 query 必须有唯一 `id`，用于返回时区分结果。最小格式：

```json
{
  "queries": [
    { "id": "artist", "group": "artist", "keyword": "rella", "limit": 5 },
    {
      "id": "character",
      "group": "character",
      "keyword": "hakurei reimu",
      "limit": 5
    }
  ]
}
```

默认只使用 Rust CLI。Rust CLI 不存在、启动失败、非 0、输出非 JSON 或缺少 `found / confirmed_tags / candidate_tags` 时，停止并报告错误，不切换旧检索实现。

## 调用场景

| 场景                     | 调用方式                                                         | 是否生图                  |
| ------------------------ | ---------------------------------------------------------------- | ------------------------- |
| 查标签/角色/作品/画师    | `bin\danbooru-tags.exe --group ...`                              | 否                        |
| 只要随机画师串           | `bin\danbooru-tags.exe --random N --json`                        | 否                        |
| 随机角色/服装/场景等候选 | `bin\danbooru-tags.exe --random N --group <group> --json`        | 否                        |
| 生图前回填锚点           | `--batch-file` 一次查多项                                        | 由 comfyui-animatool 决定 |
| 随机画师生图             | `bin\danbooru-tags.exe --random 5 --for-prompt --json --compact` | 由 comfyui-animatool 决定 |

## 随机画师规则

`--random N` 的 `N` 是请求的候选数量，CLI 只提供候选，不替模型选择规模或结果。模型按任务自选 `N`：普通抽卡建议 10–50，硬上限 1–300；只有用户明确要求大量候选时才用 100–300。不传 `--group` 时默认随机画师；带 `--group` 时随机对应 tag 候选。`--random N` 和 `--random N --for-prompt` 语义不同，不能混用：

| 用户意图                       | 正确命令                                                           | 输出字段                            | 用法                            |
| ------------------------------ | ------------------------------------------------------------------ | ----------------------------------- | ------------------------------- |
| 抽 N 个候选画师给模型挑 1 个   | `.\bin\danbooru-tags.exe --random N --json`                        | `random_artists`，长度 N            | 只调用一次；模型从数组里选 1 个 |
| 抽 N 个角色/服装/姿势/场景候选 | `.\bin\danbooru-tags.exe --random N --group clothing --json`       | `random_tags`，长度 N               | 只调用一次；模型按意图筛选      |
| 随机 1 个画师直接用于生图      | `.\bin\danbooru-tags.exe --random 5 --for-prompt --json --compact` | `random_artists_for_prompt`，长度 1 | 直接使用 `[0]`                  |

硬性要求：

- 用户说“抽取 10 个画师然后任选一个”时，只调用一次 `--random 10 --json`。
- 用户说“抽卡随机角色/服装/姿势/场景”时，只调用一次对应 group 的 `--random N --group ... --json`。
- 模型选择的 `N` 必须在 1–300 内；没有数量要求时按任务自选，普通建议 10–50，不要把 50/100 写死成所有场景默认值。
- 不要调用 10 次 `--random 5 --for-prompt --json`。
- `--for-prompt` 是生图回填模式，会故意只返回 1 个画师，避免把长画师串塞进 prompt。
- 从候选中选画师时，最多选 1 个；用户明确要求混合风格时最多 2 个。
- 随机 tag 候选不使用 `--for-prompt`；先抽候选，再由模型按兼容性筛选。
- CLI 只负责提供随机候选，不负责替模型判断抽多少；不要把用户所有模糊需求都塞进随机 tag 检索器。

候选预算与 `count`：

- 随机候选池只供模型内部筛选；最终只使用筛出的少量结果，通常展示 1–5 个关键选择，不复述完整 JSON。
- `count` 是训练覆盖与稳定性参考，不是默认硬门槛；不要默认加 `--min-count`。
- 只有用户明确要求高覆盖、高稳定或指定图量门槛时，才使用 `--min-count`。
- 不要为了给随机画师补 `count` 反复二次查询；能从当前结果判断就直接筛选。

## 硬性规则

1. 默认主索引只使用 `anima-1.0.csv`；其他历史 CSV 只允许维护或兼容排查时使用，不参与默认生图回填。
2. 画师标签只来自 CSV 原始画师分类，必须保留 `@`。
3. 其他分类不带 `@`，不能当画师标签。
4. `artists_extended.txt` 只在显式 `--extended` 时使用，不用于默认生图回填。
5. 生图回填的标签检索必须使用 `--for-prompt --json --compact`；不要把普通展示输出直接塞进 prompt。
6. `--random N --for-prompt` 只返回 1 个画师给生图分支；`--random N` 是测试串。

## 精细 group

优先用 `--group` 定向检索：

| Group                                  | 用途                                 |
| -------------------------------------- | ------------------------------------ |
| `artist` / `artists`                   | 画师                                 |
| `character` / `characters`             | 角色                                 |
| `series` / `ip` / `copyright`          | 作品/IP                              |
| `appearance` / `body`                  | 发色、发型、瞳色、耳、角、翅膀、体型 |
| `expression`                           | 表情/神态                            |
| `pose` / `action` / `camera`           | 姿势、动作、视角、构图、景别         |
| `clothing` / `outfit`                  | 基础服装                             |
| `clothing_detail` / `detail`           | 服装细节、毛边、兜帽、披风等         |
| `handwear`                             | 手套、爪手套等                       |
| `accessory` / `accessories`            | 配饰                                 |
| `scene` / `background` / `composition` | 场景、背景、天气、构图               |
| `lighting` / `light` / `atmosphere`    | 光影、阴影、逆光、窗影、景深、氛围   |
| `meta`                                 | highres、official art 等元信息       |

Anima 特殊控制词边界：

- `newest / recent / mid / early / old` 和 `year xxxx` 是 Anima 官方 time period 控制词；不需要、也不应该用本地 CSV 检索命中结果来证明它们可用。CSV 中同名普通 tag 只代表检索条目，不代表 period/year 控制语义。
- 旧画风可检索的 Danbooru 风格锚点包括 `retro_artstyle`、`faux_retro_artstyle`、`heisei_retro`、`traditional_media` 等；这些可作为普通 `general` tag 校验。
- dataset 风格词如 `deviantart` 若存在，可能位于作品/IP 类桶；是否使用由 `comfyui-animatool` 的风格意图决定，CLI 只报告候选，不主动判定应该加入 prompt。

## 批量并发与多变体

- `--batch-workers N` 控制批量查询并发，默认 4，建议 4–8；过高只会增加 SQLite 连接竞争。
- 提升准确度时，不要多次调用 CLI；在同一个 `queries` 里放同一锚点的多个变体，例如 `character` / `character_alt`、`artist_pija` / `artist_okara`。
- 模型从批量返回中筛选最匹配的 confirmed/candidate；`missing` 直接交给自然语言，不继续无限补查。
- 精细 group 只是优先过滤，不是绝对真理；部分 Danbooru 服装、构图、属性词实际属于 `general`。
- 查询常见视觉概念时，一次 batch 内放“主词 + 英文/罗马音别名 + 部件拆解”，不要失败后反复单查。
- 中文、日文俗称先翻译/转写成 Danbooru 常用英文或罗马音，再查询；中文原词只能作为辅助变体。
- 对可能被 group 白名单漏掉的概念，同一 batch 可同时放 `group=...` 与 `category=general` 变体。
- 普通生图最多 4 个语义锚点；每个锚点最多 2–3 个变体；总 query 控制在 12–16 内。
- `--compact` 结果只读 JSON 后筛选，不要向用户复述完整检索过程。
- group 精确过滤无命中时返回的 general 候选只作为 `candidate_tags`；不能当作硬 confirmed 直接批量回填。

示例：用户说“巫女服”，不要只查 `group=clothing keyword=巫女服`。一次 batch 查询：

```json
{
  "queries": [
    {
      "id": "miko_clothing",
      "group": "clothing",
      "keyword": "miko",
      "limit": 5
    },
    {
      "id": "miko_general",
      "category": "general",
      "keyword": "miko",
      "limit": 5
    },
    {
      "id": "miko_hakama",
      "group": "clothing",
      "keyword": "hakama",
      "limit": 5
    },
    {
      "id": "miko_sleeves",
      "group": "clothing",
      "keyword": "wide sleeves",
      "limit": 5
    },
    {
      "id": "miko_detached_sleeves",
      "group": "clothing",
      "keyword": "detached sleeves",
      "limit": 5
    },
    {
      "id": "miko_japanese_clothes",
      "group": "clothing",
      "keyword": "japanese clothes",
      "limit": 5
    }
  ]
}
```

## 输出契约

`--for-prompt --json --compact` 输出：

| 字段             | 用法                                     |
| ---------------- | ---------------------------------------- |
| `found`          | 是否有可确认锚点；`false` 时不要冒充命中 |
| `confirmed_tags` | 高置信锚点，可回填但仍需筛选             |
| `candidate_tags` | 候选项，必须按用户意图筛选               |

单项和批量 compact 都保留 `confirmed_tags / candidate_tags` 分层。batch 额外有 `results`、`missing`、`usage`。

人工查看可不用 `--compact`；生图回填默认使用 `--compact`，减少上下文占用。

## 回填策略

采用“Danbooru 锚点确认 + nltags 补足”：

1. 角色、作品、画师、基础外观优先查到并回填。
2. 服装/配饰/动作/场景/光影先查可确认 tag，再筛选。
3. 若由 `comfyui-animatool` 生图调用，以其最多 4 项批量查询限制为准；场景/光影通常进入 `environment` 或 `nltags`。
4. 复合短语拆成可确认锚点，例如 `fur-trimmed hooded cape` → `fur trim`、`hood`、`cape`。
5. 查不到完整组合时不要编 tag，交给 `nltags`：例如 `She wears a fur-trimmed hooded cape and oversized paw gloves.`。
6. 不要把 `candidate_tags` 整组塞进 prompt。
7. 不要堆 30+ 个松散 tag；Anima 有 tag dropout 训练，少量硬锚点更稳。

## 常用命令

```powershell
.\bin\danbooru-tags.exe --batch-workers 8 --batch-file .\batch_tags.json --for-prompt --json --compact
.\bin\danbooru-tags.exe --group artist --prefix "@dair" --limit 5 --for-prompt --json --compact
.\bin\danbooru-tags.exe --random 10 --json
.\bin\danbooru-tags.exe --random 20 --group clothing --json
.\bin\danbooru-tags.exe --random 20 --group character --json
.\bin\danbooru-tags.exe --random 5 --for-prompt --json --compact
```

单项查询用于人工查 tag 或补查；生图默认优先批量查询。

## SQLite / Rust

- 有 `tags_index.sqlite` 时优先查 SQLite，不预读 JSON。
- 精细 group 通过 `tag_groups` 缩小候选，CLI 只做最终排序和输出格式化。
- 更新 CSV 或白名单后运行 `python build_index.py` 重建 JSON 与 SQLite。
