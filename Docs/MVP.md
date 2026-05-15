# MVP documentation pack

This file is the **minimal product + technical spec** for the first shippable slice. The full reference remains [360Brew_Analyzer_PRD_v1.md](./360Brew_Analyzer_PRD_v1.md).

## 1. Product goal (MVP)

Deliver a **research-grounded LinkedIn coach**: help a user understand how their **profile text**, **recent behavior narrative**, and **draft posts** could be read together in the spirit of LinkedIn’s published **360Brew** paper (arXiv:2501.16450)—using **Anthropic Claude** as the analytical engine (per PRD), not LinkedIn’s private model.

**Out of MVP scope:** peer comparison module, scheduled PDF reports, billing, mobile app shell, LinkedIn scraping, real algorithm scores, guarantees on reach or hiring.

**Honest positioning:** directional insights + confidence labels + mandatory disclaimers (see PRD).

## 2. MVP feature set (three analyzers)


| Module       | Input                                                | Output                                                 |
| ------------ | ---------------------------------------------------- | ------------------------------------------------------ |
| **Profile**  | Structured profile text (paste or extension capture) | Scores, issues, rewrites, classification-style summary |
| **Behavior** | Logged or captured interaction summary               | Coherence / dilution, niche alignment notes            |
| **Content**  | Draft post + optional profile/behavior context       | Alignment check, edit suggestions                      |


One **structured JSON** response shape per analyzer (stable contract for UI later).

## 3. Current engineering context (this repo)

- **Extension:** `linkedin_extension_v2/linkedin_extension` — collects LinkedIn-side data; local API base in `extension/shared/env.js`.
- **Backend:** FastAPI under `backend/` — Mongo via `app/db/mongodb.py`, existing collections for metrics/outreach/resume (see below).
- **Local dev:** `.env` at extension root — `MONGODB_URI`, `APP_ENV=development`; PDF generation optional (`RESUME_PY_PDF_BASE_URL` empty).

**Existing Mongo layout (do not overload for analyzer unless intentional):**

- DB `mongodb_db_name` (e.g. `client_linkedin_tracker`): `linkedin_metrics`, `linkedin_outreach_dashboard`
- DB `resume_service`: resume-master collections
- DB `activity-tracker`: `clients`

## 4. Analyzer Mongo collections (implemented)

In the **main** DB (`MONGODB_DB_NAME`):

- `brew_profile_snapshots` — `schemaVersion`, `createdAt`, `profile` (camelCase payload)
- `brew_profile_analyses` — `contextPack`, `contextPackVersion`, `promptVersion`, `model`, `results`, `snapshotId`, `createdAt`

Indexes are created on backend startup (`init_mongodb`).

## 5. API MVP (backend)

Implemented routes (FastAPI, prefix `/api`):


| Method | Path                                   | Purpose                                                                                                                                                                                  |
| ------ | -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST` | `/api/analyzer/profile/ingest`         | Persist a profile JSON (extension-shaped); returns `snapshotId`                                                                                                                          |
| `POST` | `/api/analyzer/profile/analyze`        | Body: `{ "snapshotId", "includeLatestMetrics" }` — context pack (`profile_pack_v1`), optional latest `linkedin_metrics`, **Anthropic Claude** Messages API, then `brew_profile_analyses` |
| `POST` | `/api/analyzer/profile/analyze-inline` | Same, with inline `profile` object                                                                                                                                                       |


Mongo collections (main DB): `brew_profile_snapshots`, `brew_profile_analyses`.

**Prompts:** `profile_outreach_verdict_v1` (interim outreach verdict; PRD’s full 360Brew profile scorer is a separate prompt family later).

**Secrets:** `ANTHROPIC_API_KEY` for analyzer routes (per PRD). `OPENAI_API_KEY` remains for existing `/api/outspark/ai/`* proxy used by the extension elsewhere.

## 6. Extension MVP role

- Continue to **supply structured profile (and later behavior)** to the backend.
- **No** requirement for Flutter or a separate consumer app for MVP; a **debug UI** (sidebar or minimal page) optional.

## 7. Definition of done (MVP)

- All three analyzers callable end-to-end with **real or fixture** data through the **API**
- Results are **schema-validated** JSON with **confidence / disclaimer** fields
- `promptVersion` + model id stored on each analysis
- One manual test path documented (curl or extension button) — no production deploy required

## 8. Next documentation edits (optional)

- Link this `MVP.md` from a root `README.md` when you add one for the monorepo.
- When routes exist, add **OpenAPI** export or a short **API.md** with example payloads only.

## 9. Reference map


| Topic                         | Where                                                        |
| ----------------------------- | ------------------------------------------------------------ |
| Full PRD + prompts + UI ideas | [360Brew_Analyzer_PRD_v1.md](./360Brew_Analyzer_PRD_v1.md)   |
| Extension data flow / storage | `linkedin_extension_v2/linkedin_extension/docs/`             |
| Backend runbook               | `linkedin_extension_v2/linkedin_extension/backend/README.md` |


