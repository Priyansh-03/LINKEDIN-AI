# Brew MVP — what is built vs PRD output

## Are “all the layers” built?

**No.**

| Layer / module (PRD sense) | Status |
|----------------------------|--------|
| **LinkedIn Layer 1 — retrieval** (candidate set) | **Not built** — internal to LinkedIn. |
| **LinkedIn Layer 2 — ranking** (LLM on profile + history + task) | **Not replicated** — we do not run LinkedIn’s model. |
| **Our analog — verbalize inputs → one LLM → structured JSON** | **Built** (MVP): `dataset.json` + OpenRouter (`tools/brew-mvp-openrouter`) and/or `POST /api/analyzer/mvp/run`. |
| **PRD Module 1 — full Profile Analyzer** (`analysis_metadata`, `sub_analyses`, full `composite_classification`, paste-ready rewrites, etc.) | **Not built** — schema in [360Brew_Analyzer_PRD_v1.md §7 OUTPUT FORMAT](360Brew_Analyzer_PRD_v1.md) is much larger than the MVP audit. |
| **PRD Module 2 — Behavior Analyzer** | **Not built** (only synthetic `behaviorSignals` in `dataset.json` for demo). |
| **PRD Module 3 — Content Analyzer** | **Not built**. |
| **Extension → Claude outreach verdict** (`/api/analyzer/profile/analyze-inline`) | **Built** — different output shape (`verdict` / `connectMessage`), not the PRD profile report. |

---

## What the PRD document asks for (Profile Analyzer JSON)

From **PRD §7** (representative structure):

- `analysis_metadata` — user context, date, framework version  
- `sub_analyses` — headline, about, experience, skills, recommendations, featured, …  
- `composite_classification` — tier + score + reasoning  
- `top_issues` — severity, issue, fix, confidence  
- `improvement_projection` — 30 / 60 / 90 day text  
- `paper_grounded_disclaimer` — mandatory disclaimer string  

Plus **§7.5** narrative deliverables (score dashboard, paste-ready rewrites, action plan). The **machine contract** the PRD stresses is **valid JSON** with those logical blocks.

---

## What this MVP actually outputs (today)

### File: `output/wellness.json` (or any path you pass to `--out=`)

Auto-named batch files in `output/`: **`wellness.json`**, **`aiml.json`**, **`sales.json`** (one word each).

Wrapper envelope + **`results`** object from the model:

| Field | Purpose |
|-------|---------|
| `buildInfo` | Scope vs PRD/LinkedIn + `pipelineVersion` (e.g. `brew_mvp_profile_analyzer_prd_v2_two_pass`). `prdProfileModule_fullJsonSchema: true` when Node emits PRD §7-shaped `results`. |
| `prdReference` | Points to PRD + MVP.md |
| `pipeline.layerTrace` | L0–L5 steps; two-pass runs include `L2_passA_sub_analyses`, `L3_passA_completion`, `L2_passB_synthesis`, `L3_passB_completion`, then L4/L5. |
| `pipeline.layerOutputs` | **Per-layer artifacts:** L0 summary, L1 full verbalization blocks, L2 assembled prompts (full `content`), L3 raw model text + usage, L4 validation summary. Large; intended for inspection and audits. |
| `pipeline.twoPass` | Boolean. |
| `run` | `promptVersion`, `model`, `datasetPath`, `generatedAt`, `usage` (merged across passes when `twoPass`). |
| `outputValidity` | `{ ok, errors }` from L4 (PRD §7 top-level keys + `sub_analyses.featured` rubric scores, composite tier, etc.). |
| `results` | **PRD Profile Analyzer JSON**: `analysis_metadata`, `sub_analyses` (A–F including Featured item_count / niche_alignment / recency / content_mix), `composite_classification` (tier G), `top_issues`, `improvement_projection`, `paper_grounded_disclaimer`. |

This is a **deliberately smaller** JSON than PRD §7 so we can ship one end-to-end path before growing `sub_analyses` and rewrites.

### How to generate the file

From repo:

```bash
cd tools/brew-mvp-openrouter
export OPENROUTER_API_KEY=…   # or source ../../.env if your key is there
node run.mjs --out=../../output/wellness.json
```

Logs (usage, reasoning tokens) go to **stderr**; the **output file** is valid JSON only.

---

## Node `results` vs PRD §7 (current)

With `brew_mvp_profile_analyzer_prd_v2_two_pass`, **`results` is the PRD Profile Analyzer JSON** (Pass A `sub_analyses` merged with Pass B synthesis). L4 checks top-level keys, Featured rubric scores, composite tier/score, `top_issues` (3–10), `improvement_projection` 30/60/90, and disclaimer citing **arXiv:2501.16450**.

Optional next step: ship a formal **JSON Schema** file for CI validation (PRD also calls for a validation layer). Legacy condensed MVP keys (`oneLineVerdict`, …) are no longer emitted by the Node tool.
