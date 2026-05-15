# Brew MVP — OpenRouter TypeScript SDK

Runs a **layered** 360Brew-style audit pipeline (see `lib/layer*.mjs`) with the official [**@openrouter/sdk**](https://openrouter.ai/docs/sdks/typescript) and **streaming** so you can inspect **reasoning / usage** on the final chunk.

**Layers (Node):** `L0` ingest/validate → `L1` deterministic verbalization (retrieval analog) → `L2` assemble system+user messages → `L3` OpenRouter completion → `L4` JSON parse + required-key validation → `L5` output envelope (`pipeline.layerTrace` + `pipeline.layerOutputs` in the JSON file).

### Layer trace JSON (debug)

To dump **each step** as its own file (e.g. `L1_verbalize.json`, `L3_passA_completion.json`), set a **base directory**; each run creates a subfolder named by `run.traceId` (UUID):

```bash
export BREW_MVP_LAYER_TRACE_DIR=/tmp/brew-trace
node run.mjs --datasets=./dataset.json --out=/tmp/out.json
# or: node run.mjs --layer-trace-dir=/tmp/brew-trace …
```

Files include `L0_load_dataset.json`, `L1_verbalize.json`, `L2_passA_messages.json`, `L3_passA_completion.json` (and micro/repair variants if used), `L3_passB_completion.json`, `L4_parse_validate_two_pass.json`, `_trace_meta.json`, etc. Large `rawText` / message bodies are truncated unless you raise `BREW_MVP_LAYER_TRACE_RAW_MAX_CHARS` or `BREW_MVP_LAYER_TRACE_MSG_MAX_CHARS`.

**Profile Studio (FastAPI):** the backend sets `BREW_MVP_LAYER_TRACE_DIR` to a temp folder during `run.mjs`, then copies the trace to  
`tools/brew-mvp-openrouter/output/studio-layer-traces/<user_id>/<traceId>/`  
and adds `pipeline.layerTracePersistedDir` on the returned envelope so you can open the JSON files after an analyze run.

Python `POST /api/analyzer/mvp/run` should stay aligned on prompt version; user-message shape is mirrored in `brew_mvp_service.py` when updated.

## Workflow (in depth)

This tool implements a **local offline-first pipeline** that ends in a single JSON envelope per run. Nothing talks to LinkedIn’s production stack; the only network call is **OpenRouter** (your chosen model, default Claude Haiku).

### Purpose

Approximate how **360Brew-style** systems use **verbalized profile text** plus **verbalized activity** as LLM context (paper: arXiv:2501.16450). The **Profile Analyzer** branch of your PRD is encoded as: (1) prompts under `lib/prompts/`, (2) strict **PRD §7-shaped JSON** from the model, (3) **L4 validation** so bad or truncated JSON is surfaced instead of silently accepted.

### Inputs

- **`dataset.json` (and variants)** at repo root: `profile`, optional `userContext` (niche, goals, geography…), `metricsSummary`, `behaviorSignals`, `taskInstruction`. Paths are resolved from `BREW_MVP_DATASET`, `--datasets=`, `BREW_MVP_DATASETS`, or `--batch`’s default trio.

### Stage L0 — ingest

`runLayer0LoadDataset` reads the file, `JSON.parse`s it, and validates the MVP input contract (manual-paste equivalent):
- `profile.headline` string (max 220 chars)
- `profile.about` string (max 2600 chars)
- `profile.experienceItems[]` with `title`, `company`, `duration`, `description` strings
- `profile.skills` string array
- `profile.education[]` object array
- `profile.certifications[]` object array
- `profile.recommendations` string array

Profile URL submission (`profileUrl` / `linkedinProfileUrl`) is intentionally rejected in this MVP phase. On validation failure the run stops with exit code `1` before any API spend.

Optional quality inputs (`userContext`, all optional but validated if provided):
- `declared_niche` (string, max 240)
- `geography` (string, max 240)
- `career_goal` (one of `Growth` / `Job Seeking` / `Both`)
- `industry_context` (string, max 240)
- `years_experience` (string, max 240)
- `target_audience` (string, max 240)

Behavior analyzer schema inputs (`behaviorSignals`, optional but validated if provided):
- `collectionMethod`: `manual_logging` (MVP) | `periodic_export` | `voice_log` (future)
- `tosCompliant`: must be `true` when provided
- `actionLogs[]` entries with:
  - `actionType` enum:
    - `reaction`, `comment`, `share_repost`, `profile_view`, `connection_request_sent`,
      `connection_request_accepted`, `job_view`, `job_save`, `job_application`,
      `search_performed`, `company_followed`, `post_saved`
  - `targetClassification` enum:
    - `in_niche`, `adjacent_niche`, `off_niche`, `senior_content`, `junior_content`,
      `target_company_content`, `hiring_manager_content`
  - metadata: `timestamp` (required), `personOrCompany` (optional), `commentLength` (optional, non-negative), `notes` (optional)

Flow recommendation:
- Keep profile and behavior as separate flows:
  - `profile_flow` (existing PRD profile analyzer)
  - `behavior_flow` (new formula-driven Module 2 synthesis from `behaviorSignals`)
- Fuse them only at final reporting/action-plan stage.

Content analyzer pre-publish inputs (`contentDraft`, mandatory for Module 3 run):
- `postText` (full draft text)
- `intendedFormat` enum: `text|multi_image|carousel|video|document`
- `intendedPublishAt` (string datetime label)
- `hookArchetype` (optional string; auto-detected in MVP)

Module 3 currently runs as a separate `content_flow` and pulls:
- Profile Analyzer output (tier + text signals)
- Behavior Analyzer output (niche coherence + behavior score)
- Historical posts DB (`historicalPosts` input, 10-30 posts with performance metrics)
- Hook archetype library (12 built-in archetypes with automatic draft detection)

Comparative Intelligence inputs (`peerBenchmark`, optional but validated if provided):
- `collectionMode`: must be `manual`
- `tosCompliant`: must be `true`
- `peerProfiles[]`: manual peer entries (name + optional url + benchmark metrics)

Module 4 runs as `comparative_flow` with A/B/C/D sub-analyses:
- profile tier comparison
- content strategy comparison
- behavioral pattern comparison
- synthesized gap analysis (lead/lag/neutral)

Module 5 runs as `reporting_recommendations_flow`:
- daily mission report
- weekly performance report
- monthly audit report
- quarterly re-audit plan
- recommendation prioritization engine using:
  `priority_score = (Impact * Confidence * Urgency) / Effort`

### Stage L1 — verbalize (retrieval analog)

`runLayer1Verbalize` turns structured slices into **deterministic text blocks**: meta, profile narrative, metrics JSON (minified), behavior JSON (minified). This is your **“Layer 1 verbalization”** analog: fixed, auditable context, not a second LLM.

### Stage L2 — prompt assembly

- **Default (`BREW_MVP_TWO_PASS` ≠ `0`):**  
  - **Pass A:** system text from `profile-analyzer-pass-a.txt` + user blob = PRD **USER_CONTEXT / PROFILE DATA** blocks + L1 blocks + **canonical minified full dataset** → model returns **only** `sub_analyses` (PRD sections A–F), kept compact in the prompt.  
  - **Pass B:** system from `profile-analyzer-pass-b.txt` + same user context + **embedded Pass A JSON** → model returns **`analysis_metadata`**, **`composite_classification`** (tier G), **`top_issues`**, **`improvement_projection`**, **`paper_grounded_disclaimer`** — no second copy of `sub_analyses`.

- **Single-pass (`BREW_MVP_TWO_PASS=0`):** one system (`profile-analyzer-prd-system.txt`) + one user message; needs a higher **`BREW_MVP_MAX_TOKENS`** budget.

### Stage L3 — model (OpenRouter)

`@openrouter/sdk` streams the completion; **`response_format: json_object`**. Per-pass **`max_tokens`** defaults are conservative so low-credit accounts are less likely to hit 402; tune with `BREW_MVP_MAX_TOKENS_PASS_A` / `_PASS_B` / `BREW_MVP_MAX_TOKENS`. Usage is merged for two-pass and written under `run.usage`.

### Stage L4 — parse and validate

`parseJsonObject` strips accidental markdown fences. **Pass A:** `validateSubAnalysesShape` (including Featured rubric scores). **Pass B:** `validateSynthesisShape`. Merged object is checked with **`validatePrdProfileOutput`**. Failure → exit `2`, envelope still written with `outputValidity.errors` and previews when useful.

### Stage L5 — envelope

`runLayer5BuildEnvelope` adds **`buildInfo`** (scope vs LinkedIn/PRD modules), **`prdReference`**, **`run`** metadata, **`pipeline.layerTrace`** (timings, usage per step), **`pipeline.layerOutputs`** (full L1 verbalizations, L2 messages, L3 raw texts, L4 summary), **`results`** (final PRD JSON), **`outputValidity`**.

### Batch mode

`--batch` runs **three** datasets sequentially (wellness → aiml → sales). Each run is independent (separate API bill). If one call throws (e.g. 402), that file gets an **error stub** with partial `layerOutputs`; the loop continues. Exit code is the **max** of per-run codes (`0` / `2` / `3` / `1`).

### Output filenames (one word)

When the tool picks the path ( **`--out-dir`** or multi-run default ), files are named by a **single slug** + `.json`: **`wellness.json`**, **`aiml.json`**, **`sales.json`** for the default trio. Custom dataset basenames get a slug by stripping non-alphanumeric (e.g. `my-data.json` → `mydata.json`). **`--out=/exact/path.json`** is unchanged — you control the name.

---

## Setup

```bash
cd tools/brew-mvp-openrouter
npm install
export OPENROUTER_API_KEY=sk-or-v1-...
```

## Run

Default model: `~anthropic/claude-haiku-latest`  
Default dataset: repo-root `linkedin AI/dataset.json` (two levels up from this folder).

```bash
npm start
```

- **stdout:** streamed assistant text (JSON object), unless `--out=...` is set.
- **stderr:** token usage and `completionTokensDetails.reasoningTokens` when present.

Write PRD-aware envelope + model JSON to a file (quiet on stdout):

```bash
node run.mjs --out=../../output/wellness.json
```

Run **all default datasets** sequentially (`dataset.json`, `dataset-aiml.json`, `dataset-sales.json` at repo root), one **one-word** output file per dataset:

```bash
npm run batch
# same as:
node run.mjs --batch --out-dir=../../output
# → ../../output/wellness.json, aiml.json, sales.json
```

Custom paths (comma-separated, no spaces):

```bash
node run.mjs --datasets=../../dataset.json,../../dataset-aiml.json --out-dir=../../output
```

See [Docs/Brew_MVP_Output.md](../../Docs/Brew_MVP_Output.md) for how this compares to the **full** Profile Analyzer JSON in the PRD.

### Environment

| Variable | Purpose |
|----------|---------|
| `OPENROUTER_API_KEY` | Required |
| `BREW_MVP_MODEL` | Override model (default `~anthropic/claude-haiku-latest`) |
| `BREW_MVP_DATASET` | Absolute path to alternate `dataset.json` |
| `BREW_MVP_TWO_PASS` | Default `1` (on): PRD Pass A + Pass B for reliable JSON under token ceilings. Set `0` for one-shot (needs `BREW_MVP_MAX_TOKENS` headroom). |
| `BREW_MVP_MAX_TOKENS_PASS_A` / `BREW_MVP_MAX_TOKENS_PASS_B` | Completion caps per pass (defaults `2400` / `2000`). Batch runs **three** API cycles—top up credits or lower caps if you see 402. |
| `BREW_MVP_MAX_TOKENS` | Single-pass completion budget (default `5600`). |
| `OPENROUTER_HTTP_REFERER` | OpenRouter app referer (default `https://localhost`) |
| `OPENROUTER_APP_TITLE` | Dashboard title (default `BrewAnalyzerMVP-Node`) |

PRD prompt sources: `lib/prompts/profile-analyzer-prd-system.txt` (single-pass system), `profile-analyzer-pass-a.txt`, `profile-analyzer-pass-b.txt` (two-pass).

### Per-layer output in the JSON file

When writing `--out` / `--out-dir`, the envelope includes **`pipeline.layerOutputs`** with the full payload per stage:

| Key | Contents |
|-----|----------|
| `L0_ingest_dataset` | Parsed dataset summary (keys, headline, flags). |
| `L1_verbalize_context` | `stats` + full `verbalization` blocks (meta, profile, metrics, behavior). |
| `L2_prompt_assembly` | Full `messages[]` (`role`, `content`, `charCount`) — two-pass has `passA` / `passB`. |
| `L3_model_completion` | Full `rawResponseText` per pass + `usage`; single-pass is one object. |
| `L4_parse_validate` | Validation errors, `resultsTopLevelKeys`, pass A/B errors when two-pass. |

API failures still write **`layerOutputs` for completed layers** (e.g. L0–L3 partial) on the error stub file.

## SDK shape

This matches OpenRouter’s documented wrapper:

```js
await openrouter.chat.send({
  chatRequest: {
    model: "...",
    messages: [{ role: "system", content: "..." }, { role: "user", content: "..." }],
    stream: true,
    responseFormat: { type: "json_object" },
  },
});
```

The flat `{ model, messages, stream: true }` form is not what the generated SDK expects; `chatRequest` is required.
