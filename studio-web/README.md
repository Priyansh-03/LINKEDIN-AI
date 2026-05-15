# LinkedIn AI — Profile Studio (localhost)

Small React UI for editing the canonical Brew MVP dataset shape, saving to MongoDB database **`linkedin_ai`**, and running the Node pipeline (`tools/brew-mvp-openrouter`).

**Dev URL:** this app listens on **http://127.0.0.1:5180** by default (not `5173`, so it does not clash with other local Vite apps such as Kharcha). Override with `VITE_DEV_PORT=5173 npm run dev` if you prefer.

## Prerequisites

1. **MongoDB** on `127.0.0.1:27017` (or set `MONGODB_URI`).
2. **Backend** FastAPI with `.env` including at least:
   - `MONGODB_URI`
   - `STUDIO_MONGODB_DB=linkedin_ai` (default if omitted matches this name)
   - **One of:** `OPENROUTER_API_KEY` + optional `OPENROUTER_MODEL` / `OPENROUTER_BASE_URL`, or `OPENAI_API_KEY` (+ optional `OPENAI_BASE_URL`) so the Node runner can call the model API.
3. **Node** on PATH (for `node tools/brew-mvp-openrouter/run.mjs`).

## Run

Terminal A — API (from `linkedin_extension_v2/linkedin_extension/backend`):

```bash
source .venv/bin/activate
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Terminal B — UI (from repo `studio-web/`):

```bash
npm install
npm run dev
```

Open **http://127.0.0.1:5180** (Vite proxies `/api` → `http://127.0.0.1:8001` by default; set `VITE_API_PROXY` if your API port differs).

## API routes (under `/api`)

- `POST /api/studio/users` — body `{ "displayName": "..." }`
- `GET /api/studio/users`
- `GET /api/studio/users/{id}/profile`
- `PUT /api/studio/users/{id}/profile` — body `{ "payload": { ... } }`
- `POST /api/studio/users/{id}/analyze`
- `POST /api/studio/users/{id}/analyze-draft` — body `{ "postText", "intendedFormat", "intendedPublishAt" }`
