---
name: comfyui-animatool
description: Use for Anima / ComfyUI-AnimaTool image generation. Route Anima generation intent, validate Danbooru hard anchors with danbooru-tags, assemble Anima-compliant English prompts, and execute through comfyui-manager / comfyui-skill workflows
---

# Anima / ComfyUI-AnimaTool 生图入口

本 skill 只服务 `ComfyUI-AnimaTool` 的 Anima 生图策略

## 触发与分支

有 Anima 生图意图时触发：生成图、画图、出图、reroll、roll 图、抽卡、随机图、指定 Anima/画师风格并要求生成。

没有生图意图时不执行生图：

- 查角色/作品/画师/tag → 只用 `danbooru-tags`
- 只要随机画师串 → 只用 `danbooru-tags --random`
- 查模型/规则 → 交给 `comfyui-manager` 查询；

生图分支：

1. 普通生图 → `danbooru-tags` 校验硬锚点 → 组装完整 positive/negative → 通过 `comfyui-manager` 执行已导入工作流
2. 随机图 / roll / 抽卡 → `anima-random-gen` 产出参数 → 校验 → 通过 `comfyui-manager` 执行
3. 随机画师并生图 → `danbooru-tags --random 5 --for-prompt --json --compact` → 选 1 个画师 → 组装参数 → 通过 `comfyui-manager` 执行
   随机角色/服装/姿势/场景抽卡 → 按 `danbooru-tags` 的候选预算选择 `N`，用 `--random N --group <group> --json` 抽候选 → 按兼容性筛选 → 组装参数。
4. 明确画师串、多画师融合、artist mixer 或多画师权重混合 → 走 `local/anima-txt2img-aesthetic-lora-artist-mixer`，把画师写入 `artist_chain`，不要把多画师堆进普通 prompt。
5. 明确“全 Danbooru tag / 纯 tag / 不加自然语言” → 只写 tag，不写 `nltags`

## 生图前视觉简报

在组装参数前，必须先用 `anima-composition-director` 的方法形成简短视觉简报；不要把简报原样输出给用户，也不要写进 `prompt_hint`。目标是先想清楚画面，再写 prompt，避免弱模型只做词语翻译。

当需求涉及参考图构图、复杂场景、多人互动、特殊镜头、高分辨率、强光影，或模型明显缺少画面决策时，显式使用 `anima-composition-director`。本 skill 只接收它的输出：`canvas`、`camera`、`composition`、`lighting`、`focus`、`nltags_sentences`，再与 Danbooru hard anchors 组装 prompt。

视觉简报只用于决策：`character / series / artist / appearance` 锁定身份和画风；`tags` 放已确认锚点；`environment` 放短场景/光影 tag；`nltags` 使用 `anima-composition-director` 产出的短英文画面控制句。

### 分辨率与构图回写

不要一开始套默认 `1024x1536`。先按 `anima-composition-director` 的 canvas fit 固定最终 `width/height`，再把主体位置、景别、留白方向、背景展开方向回写到 `nltags`。用户明确给尺寸时必须使用，但要检查构图是否适配。

当前只按 Anima base1.0 正式版处理；默认初始生成不主动推荐任一边超过 1536。不要默认改用 `1920x1080`，更大输出交给放大节点。`1536x1536` 只用于高信息量中心构图；简单头像、表情图、普通半身图使用 `1024x1024`。

### 质量步数推断

默认 `steps=30` 追求速度与质量平衡；但模型必须根据用户意图主动调整，不要把 30 步当成所有场景的固定值。

- 普通单人、简单半身、快速测试、没有强调精修或复杂背景 → `steps=30`。
- 用户明确高质量、精修、壁纸、大场景、复杂背景、强光影、透明感、细节层次，或指定画师风格本身依赖大背景和光影表现 → `steps=40`。
- 用户给了 `1536x1536`、`1536x1024`、`1024x1536` 等高分辨率，但未说明只是快速测试时，若画面语义包含多人互动、复杂背景或光影叙事，优先 `steps=40`。
- 用户明确要求速度、草稿、测试链路、快速看构图时，即使高分辨率也可保留 `steps=30`。

## 必须先做的 tag 校验

生图前先写一个最多 4 项的检索计划，然后按 `danbooru-tags` skill 的批量入口一次取回结果。Codex/PowerShell 下必须使用 `--batch-file`，不要内联多行 `--batch-json`。

### 画师称呼解析

用户给出的画师名可能是中文圈称呼、昵称、社交平台名、画集名或社团名，不一定是 Danbooru/Anima 的 artist tag。不要维护本地固定别名表，也不要把中文昵称按字面直接丢给 tag 检索器。

流程：

1. 如果画师输入不是明确的 Danbooru artist tag（例如没有 `@`，或包含“太太/老师/画师/社团”等自然语言称呼），先进行网络搜索确认 canonical artist name、常见别名和公开资料来源。
2. 优先采用官方主页、Pixiv/X/微博资料、百科条目、画集/作品页等互相印证的信息；不要只凭单个图片聚合站结果下结论。
3. 将网络确认出的英文/罗马字画师名转为候选 `@artist`，再用 `danbooru-tags --group artist` 校验。
4. 只有 `danbooru-tags` 返回 confirmed artist 后，才写入 prompt；查不到时向用户说明无法确认 tag，或改用最接近的 confirmed artist 候选。
5. 网络搜索只用于解析称呼和别名，不替代 Anima CSV / Danbooru tag 校验。

硬性限制：

1. 不要从 `comfyui-animatool` 目录调用 `bin\danbooru-tags.exe`；PowerShell 会找错路径。
2. 普通生图最多 1 次批量查询 + 1 次补查；超过后把缺失内容写进 `nltags`。
3. 必查：角色、作品、最终选定画师。
4. 可查：最多 1 个用户明确指定且高度可标签化的外观/服装锚点。
5. 不查：构图、环境光影、恶堕/氛围、情绪、连续动作、复杂服饰组合；这些写进 `nltags`。
6. 不要把角色名当 appearance 查，例如不要查 `appearance --keyword "alice"`；命名角色外观不确定时，不要用 appearance/clothing 盲查反推设定，先依据用户参考图、官方资料或轻量网络搜索确认关键外观，再只检索少量可标签化锚点，不确定细节写入 `nltags`。
7. 只把 `confirmed_tags` 中与用户意图一致的项放入参数；`candidate_tags` 必须筛选。
8. 如需提高命中率，把同一锚点的多个候选变体放进同一个 batch 文件，例如 `artist_pija` / `artist_okara`；不要多次调用 CLI。

检索计划要一次性覆盖“主词 + 英文/罗马音别名 + 部件拆解”。中文或日文俗称不要直接当唯一 keyword；先转成 Danbooru 常用英文/罗马音。精细 group 是优先约束，不是唯一真理；对常见视觉概念，可在同一个 batch 中同时放 `group=...` 和 `category=general` 变体。

普通生图最多 4 个语义锚点；每个锚点最多 2–3 个变体；总 query 控制在 12–16 内。使用 `--compact` 后只读 JSON 并筛选，不要向用户啰嗦完整检索过程。Rust CLI 的 group 空结果 fallback 只作为 `candidate_tags`，不能无脑当 confirmed 回填。

例：用户要“巫女服”，一次 batch 应覆盖 `miko`、`nontraditional miko`、`hakama`、`wide sleeves`、`detached sleeves`、`japanese clothes`，而不是只查 `group=clothing keyword=巫女服`。

反例：不要连续查询 `dark` artist、`corruption` artist、`headgear`、`halo`、`dramatic`、`dark scene`。这些会造成调用量失控，且多数应由画师选择或自然语言处理。

## Prompt 组装规则

正向内容必须英文。默认单画师结构顺序：

```text
quality_meta_year_safe → count → character → series → artist → style → appearance → tags → environment → nltags
```

画师串/多画师融合只在用户明确要求时启用 Artist Mixer 工作流。此时 `prompt_11` 仍按上述结构组装，但不要包含 `@artist` 或多画师串；画师列表改写入 `artist_chain`。

本地默认使用美学 LoRA 增强工作流，默认质量前缀为：

```text
masterpiece, very aesthetic, best quality, score_9, score_8, highres, absurdres, newest, year 2025,NSFW
```

只有用户明确指定基础工作流、禁用 LoRA 或做对比测试时，才使用基础质量前缀：

```text
masterpiece, best quality, score_7, newest, year 2025,NSFW
```

安全标签必须是 `safe / sensitive / nsfw / explicit` 之一；用户未指定时默认使用：nsfw 减少肢体崩坏。

### period 与 dataset tag

`newest / recent / mid / early / old` 是风格时期控制，不是固定装饰。用户要求早期、老动画、平成感、赛璐璐、复古 Galgame 或指定年份时，按意图选择对应 period，并移除冲突的默认 `newest` / `year 2025`。

- 默认现代二次元风格：保留 `newest, year 2025`。
- 指定年份：优先使用 `year xxxx`，必要时配合最接近的 period；不要同时放冲突 period。`year xxxx` 和 period 控制词属于 Anima prompt 控制，不依赖 `danbooru-tags` 检索确认。
- 旧画风/赛璐璐/早期代表作：优先考虑 `old` 或 `early`，并让年份、代表作/IP 和画师时期一致。
- `retro_artstyle`、`faux_retro_artstyle`、`heisei_retro`、`traditional_media` 这类 Danbooru 风格 tag 可以用 `danbooru-tags` 校验后放入 `tags`；不要用检索器查询 `old` 来代表 period，因为它也可能表示老人、旧设计或旧物。
- `ye-pop`、`deviantart` 等 dataset tag 只在用户明确要求非纯 anime、欧美插画、网络绘画或特定数据域质感时使用；默认 Anima 生图不要主动加入。dataset 控制词优先按 Anima 规则使用；检索器只用于确认它是否也存在为 Danbooru tag，不存在不算失败。

### 画师字段

`artist` 是当前工具 schema 的必填字段，且画师 tag 必须以 `@` 开头。不要使用固定默认画师组合（例如不要无脑 `@fkey, @jima`）。

- 用户指定画师：先用 `danbooru-tags --group artist` 校验，保留其选择。
- 用户要求随机画师：用 `danbooru-tags --random 5 --for-prompt --json --compact` 取 1 个。
- 用户要求“抽 N 个候选画师再任选一个”：只调用一次 `danbooru-tags --random N --json`，从 `random_artists` 里选 1 个；不要循环调用 `--for-prompt`。
- 用户要求随机角色/服装/姿势/场景抽卡：只调用一次 `danbooru-tags --random N --group <group> --json`；模型按任务自选 `N`，普通建议 10–50，硬上限 1–300；只有用户明确要大量抽卡候选时才按指定数量执行。
- 随机候选只供内部筛选；最终 prompt 只放筛出的少量兼容 tag，不向用户复述完整候选 JSON。
- 用户未指定画师：先按风格意图从预设池选 1 个候选，再只校验该画师；不要用 `dark/corruption/恶堕` 这类风格词查 artist。
  - 日系本子 / 恶堕 / 成年向：优先候选 `@pija`, `@okara`, `@mignon`。
  - 肉感 / 黑丝白丝：优先候选 `@rhasta`, `@mignon`, `@yom`。
  - 中性通用 / 清爽二次元：优先候选 `@mignon`, `@fkey`, `@hiroichi`。
  - 最终只选 1 个并用批量查询校验。
- 用户明确不要画师：如果客户端允许空值，可传 `artist: ""`；若工具校验拒绝，先说明 AnimaTool 当前 schema 要求画师字段。
- 默认普通生图只选 1 个画师，并写入 `artist` / 普通 prompt 槽位。
- 多个画师分别出图不等于画师串。用户说“分别用 A/B 画师”“每组一个画师”“A 画师 N 张、B 画师 N 张”时，走普通默认工作流，为每个 job/prompt 写单个 `@artist`。
- 用户明确要求画师串、多画师融合、artist mixer 或多画师权重混合时，使用 `local/anima-txt2img-aesthetic-lora-artist-mixer`；把画师串写入 `artist_chain`，例如 `wlop, (sakimichan:1.2), (krenz:0.7)`（注意：**不要加 `@` 前缀**，`AnimaArtistPack` 节点已知道 `artist_chain` 全是画师名），并从 `prompt_11` 移除画师标签。
- Artist Mixer 默认参数由 `comfyui-manager` 工作流提供：`combine_mode=output_avg`、`fusion_mode=interpolate`、`artist_mixer_strength=0.7`、`artist_mixer_normalize_weights=true`、`artist_mixer_apply_to_uncond=false`。非用户要求不要改这些参数。
- Artist Mixer 权重分两层：`artist_chain` 的 `(name:weight)` 控制画师之间的相对比例；`artist_mixer_strength` 控制整体画师混合对 base prompt 的影响。
- 默认保持 `artist_mixer_normalize_weights=true`；只有用户明确要求并接受风险时才关闭。关闭后 2–3 个画师可能过曝，4+ 会被节点拒绝。
- 画师组合优先选风格相近者；差异很大的画师容易折中退化。需要主辅关系时，可从主画师 `1.0`、辅画师 `0.2–0.4` 这类相对权重开始。
- 画师串建议保持小规模；用户未指定数量时优先 2–4 个。用户明确要求更多时可以按需求执行，但应提醒画师越多速度和风格可控性越差。

### 画师时代、代表作与风格锚定

Anima 的画师控制不是单独由 `artist` 决定；`year`、代表作/IP、画师权重和槽位顺序会共同塑形。不要把 `year 2025` 当成无脑固定值，也不要随意把多个画师 tag 混合后交给模型自己处理。

- 用户指定年份、年代、旧画风、新画风、赛璐璐、某时期或某代表作时，必须把 `year` 视为风格控制参数，而不是普通元数据。此时更新 `quality_meta_year_safe` 中的年份，移除冲突的 `newest` / `year 2025`。
- 用户指定某画师的代表作、时期作品或 IP 风格时，可把该代表作/IP 作为 `series` 或 style anchor 使用；先用 `danbooru-tags --group series` 校验可用 tag，查不到时写入 `nltags`，不要伪造 Danbooru tag。
- 同一画师在不同年代可能对应不同画风；组 prompt 前要先判断用户要的是“画师整体风格”“某一时期风格”还是“某部代表作风格”。
- 画师融合时优先用 Artist Mixer 的 `artist_chain` 表达主次和权重，不要再依赖普通 prompt 中的画师顺序。只有用户明确要求强化某个时期、代表作或可见风格锚点时，才在 `artist_chain` 或代表作/IP 锚点上谨慎加权。
- 画师/代表作/年份三者不能互相冲突。例如用户要求早期风格时，不要同时保留 `newest`、现代年份和晚期代表作锚点。
- 不确定代表作对应的可用 tag 时，优先保留画师与年份，把代表作描述放入 `nltags`，不要用错误 tag 污染 hard anchors。

### hard anchors 与 `nltags` 分工

hard anchors 放可被 Danbooru 稳定控制的内容：

- 人数、角色、作品、画师
- 角色基础外观：发色、瞳色、发型、体型
- 已确认的服装、道具、姿势、表情、视角、光影、场景

`nltags` 放难以用单个 tag 表达的内容：

- 动作连续性、神态细节、叙事关系
- 镜头结构、前景/中景/背景、景深落点、主体脸部可读性
- tag 库缺失的服装/配饰/材质组合
- 光影、空间、氛围的完整描述

同一语义不要在 tags 和 `nltags` 中冲突。Anima 有 tag dropout 训练，不需要塞满所有相关 tag；优先少量硬锚点 + 清晰自然语言补足。

### 槽位一致性与冲突检查

组装 prompt 时按槽位检查，不要让模型自己“猜”冲突关系：

- 人数/身份：`solo` 不能和多人互动标签混用；睡眠、昏迷、闭眼时不要写 `looking at viewer`。
- 镜头/景别：`close-up` 与 `full body`、`from above` 与 `from below`、`from front` 与 `from behind` 不要同时出现；需要复杂镜头时改写到 `nltags`。
- 服装/状态：`completely nude` 不和具体服装同用；内衣套装和 `no panties/bottomless` 容易冲突，暴露需求优先拆成上装、下装和穿着状态。
- 动作/姿势：只保留一个主动作和一个辅助姿势；连续动作或角色关系写入 `nltags`。
- 重复标签：同一 tag 不重复写；强调靠顺序和更准确的词，不靠堆叠。
- 标签数量：普通单人 16–30 个核心 tag 即可；复杂主题最多约 40 个，超过时优先删环境、氛围、弱细节。

单人正面图默认需要脸部可读性：除非用户明确要求背影、侧脸、远景或遮脸，否则保留 `looking at viewer` / `facing viewer` 这类可见视线锚点，并在 `nltags` 中说明脸部清晰。

多人图必须明确属性归属：不要只写一组发色、瞳色、服装后接多个角色名；用简短英文句说明每个角色的关键外观、服装、相对位置和主动作。角色之间有互动时，把谁看向谁、谁在前景/后景、谁执行动作写进 `nltags`。

### 权重控制

Anima 官方支持 prompt weighting；官方示例为 `(chibi:2)`。默认不要加权，先靠准确 tag、槽位顺序和短句控制。

- 只有用户明确要求强化/弱化，或某元素多次不稳定时才加权。
- Anima 权重从 `(tag:2)` 级别开始测试；`1.1–1.3` 这类小权重通常不要作为默认方案。
- 不要给角色名、安全标签、质量前缀或整段 `nltags` 默认加权；普通单画师也不要给画师名默认加权。用户明确要求画师融合或某画师主导时，优先在 Artist Mixer 的 `artist_chain` 中表达主次；某年代/代表作风格可谨慎对代表作/IP 或关键可见风格锚点加权，并保持同一 prompt 最多 1–3 个加权点。
- 不要大面积加权；同一 prompt 最多处理 1–3 个关键视觉元素。
- 权重只用于可见元素，例如 `(chibi:2)`、`(red eyes:2)`；抽象氛围优先改写为光源、构图或表情。

### `nltags` 画面控制规则

自然语言只写画面控制指令，不写小作文。目标是决定“画什么、怎么摆、光从哪来、镜头怎么拍”。

- 默认 2–4 句；复杂构图最多 5 句。
- 单句尽量 8–18 个英文词，最多约 25 个词。
- 每句只控制一个画面要素：动作、姿势、镜头、构图、光源、背景层级、脸部质量。
- 禁止文学修辞、比喻、世界观解释、剧情说明、营销式形容词堆叠。
- 禁止用抽象情绪替代可见画面；把 `mysterious, fallen, cinematic` 改成可见光影、表情、姿势。
- 不写“debut volume cover / title text placement”这类出版设计说明，除非用户明确要求文字排版。
- 不要把同一语义在 tags 与 `nltags` 重复扩写。
- 背景不是主体时，默认用轻微背景虚化或景深分离主体；背景本身是重点时，只说明层级和景深落点。
- 写法优先使用直接控制句：`Place her full body slightly right of center.` / `Use a low front camera angle.` / `Keep her face sharp and undistorted.`

反例：长段落描述角色命运、城市氛围、光芒碎片和封面情绪，会稀释主体。应压缩成动作、姿势、光源、构图和背景层级。

## 多图与批量策略

默认只生成 1 张。只有用户明确要求“多张 / 几批 / 抽卡 / 多方案 / 每张不同内容 / 串行 / 并行”时才启用批量。

`comfyui-animatool` 是 Anima 生图意图与参数来源。批量任务中，每个 job 的 prompt、`width`、`height`、`batch_size`、`steps`、`rtx_vsr_quality` 和 `filename_prefix` 必须先在本 skill 中确定，再交给 `comfyui-manager` 执行。

先区分两类需求：

1. **同 prompt 多变体**：同角色、同构图、同提示词，只想要不同随机结果。使用同一个 args，设置 `batch_size=N`。
2. **多 prompt 多任务**：每张图的角色、服装、随机 tag、构图或画布不同。为每张图分别组装 prompt 和 args，通过 `comfyui-manager` 提交多个 job。

规则：

- 用户没说数量：`batch_size=1`，只提交 1 个 job。
- “出 N 张同类型不同种子”：优先 `batch_size=N`；如果用户要求记录每张 seed，改为 N 个 job，每个 job 显式 `seed`。
- “第一张 A，第二张 B”：不能用 `batch_size`；必须分别写 `prompt_11` / `filename_prefix` 并提交多个 job。
- “分别用 A/B 画师各出 N 张”：不是画师串；每个 job 只写一个 `@artist`，仍用默认工作流。
- “随机 tag 抽卡出 N 张”：每张先抽/筛一组兼容 tag，再分别组 prompt；不要把 N 套随机 tag 塞进同一个 prompt。
- 批量时每个 prompt 仍遵守：先视觉简报 → tag 校验/随机候选筛选 → canvas_fit → prompt 自检。
- 普通批量默认按 `steps=30` 平衡速度和质量；用户明确要求高质量串行/并行生图、精修构图，或显式指定步数时，允许对应 job 使用 `steps=40`。
- 临时脚本、辅助脚本或一次性批量提交脚本只能读取/提交本 skill 已确认的 args，不得自行决定 prompt、`steps`、画布、模型或 `filename_prefix`。
- 批量输出时只汇总每张的编号、简短主题、`local_path`；不要把完整 prompt 和检索 JSON 全部复述给用户。

## 默认参数（以本地 schema/executor 为准）

普通生图默认：

```json
{
  "prompt_11": "完整英文正向提示词，默认使用美学质量前缀",
  "prompt_12": "完整英文负向提示词",
  "width": 1024,
  "height": 1536,
  "batch_size": 1,
  "steps": 30,
  "rtx_vsr_quality": "ULTRA",
  "filename_prefix": "anima/%year%-%month%-%day%/anima_base_v1_0-validated_artist-kanade_tachibana"
}
```

常用覆盖：

- 3:2 横图：`width=1536, height=1024`
- 16:9 横幅：`width=1536, height=864`
- 4:3 横图：`width=1536, height=1152`
- 3:4 竖图：`width=1152, height=1536`
- 2:1 宽幅：`width=1536, height=768`
- 方图：`width=1024, height=1024`
- 大方图：`width=1536, height=1536`，仅用于高信息量中心构图
- 高质量构图 / 大场景 / 强光影 / 复杂背景 / 高分辨率精修：`steps=40`
- RTX VSR 质量：`rtx_vsr_quality="LOW|MEDIUM|HIGH|ULTRA"`
- TeaCache 版本通常不传；如需覆盖 `teacache_version`，必须传完整枚举值 `v1 (Legacy Fast)` 或 `v2 (Standard Precise)`，不要传短值 `v1` / `v2`。

`filename_prefix` 必须按 `comfyui-manager` 的 Anima 输出命名规则生成：`anima/%year%-%month%-%day%/<model_tag>-<artist_tag>-<character_tag>`。本 skill 只决定 `model_tag`、`artist_tag`、`character_tag` 的语义来源；具体保存、自动编号和 workspace 缓存规则由 `comfyui-manager` 执行。

## 参考图处理

用户提供参考图时先判断参考范围。若只说“参考构图/视角/景深”，不要复制参考图的角色、服装、发色、道具或场景。

把参考构图拆成：镜头距离、视角强度、前景/中景/背景、景深落点、主体脸部可读性、是否允许鱼眼或夸张广角。稳定 tag 放 hard anchors，复杂结构写入 `nltags`。

## 生图前自检

1. 已先形成视觉简报，明确主体、镜头、构图、光影、取舍。
2. 核心角色/作品/画师/tag 已经用 `danbooru-tags` 校验。
3. 正向字段是英文，tag 小写空格；`score_7` 这类分数标签保留下划线。
4. `quality_meta_year_safe` 含安全标签。
5. `artist` 是 `@artist name`，或已处理“不要画师”的 schema 例外。
6. 若启用 Artist Mixer，画师在不带 `@` 的 `artist_chain` 中，`prompt_11` 不重复包含多画师标签。
7. 槽位顺序正确。
8. tags 与 `nltags` 不冲突。
9. 已完成 `prompt_semantic_draft → canvas_fit → final_composition`，构图描述与最终 `width/height` 一致。
10. 未被用户覆盖时使用当前本地默认参数。
11. 首次使用、迁移环境或遇到 `400` / `value_not_in_list` 时，确认默认工作流引用的模型、CLIP、VAE、LoRA 在当前 ComfyUI 环境中可访问；具体检查交给 `comfyui-manager`。

## 可验证案例：普通角色生图

用户：生成天使心跳的立华奏，三无感，教室窗边柔光。

先批量校验角色、作品、最终画师，以及一个必要外观锚点；教室窗边柔光写入 `environment` / `nltags`，不额外查环境光影。

```json
{
  "quality_meta_year_safe": "masterpiece, very aesthetic, best quality, score_9, score_8, highres, absurdres, newest, year 2025, safe",
  "count": "1girl",
  "character": "kanade tachibana",
  "series": "angel beats!",
  "artist": "@validated artist",
  "appearance": "silver hair, yellow eyes, long hair, school uniform",
  "tags": "solo, expressionless, looking at viewer, face focus, eye focus, depth of field",
  "environment": "classroom, window, soft light, backlighting, blurry background",
  "nltags": "Place her beside the classroom window, facing the viewer. Use soft daylight from the left side. Keep her face centered, sharp, and undistorted. Blur the classroom background gently.",
  "neg": "worst quality, low quality, score_1, score_2, score_3, blurry, bad anatomy, bad hands, bad feet, extra fingers, missing fingers, distorted face, text, watermark, logo, artist name",
  "width": 1024,
  "height": 1536,
  "batch_size": 1,
  "steps": 30,
  "rtx_vsr_quality": "ULTRA",
  "filename_prefix": "anima/%year%-%month%-%day%/anima_base_v1_0-validated_artist-kanade_tachibana"
}
```

## 执行交接

- 本 skill 决定语义参数：prompt、负面提示词、画布、steps、批量意图、画师串意图和 `filename_prefix` 语义来源。
- 生图执行、CLI 参数传递、缓存、队列和执行层节点护栏交给 `comfyui-manager`；本 skill 不主动覆盖 FLSampler、TeaCache、AnimaBoosterLoader 等执行节点参数。
- 默认使用 `local/anima-txt2img-aesthetic-lora`；`local/anima-txt2img-aesthetic-lora-artist-mixer` 只在用户明确要求画师串/多画师融合时使用。
- `local/anima-txt2img-base` 只在用户明确指定基础版、禁用 LoRA、对比测试或排查问题时使用。
- 默认已使用 aesthetic-lora 工作流；不要把 LoRA 名写进 prompt。

