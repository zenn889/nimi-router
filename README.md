# nimi-router

An AI model router with a dashboard — inspired by [9Router](https://github.com/9router/9router).
OpenAI-compatible API with **smart fallback** across multiple providers, deployable to Vercel.

## Features

- 🔀 **Smart fallback** — providers tried in priority order; on 429 / 5xx / network error / bad key, the router automatically moves to the next provider
- 🔑 **Multi-key per provider** — each provider can hold many API keys; requests rotate round-robin across keys, and a key that errors is cooled down automatically (429 → 60s, 401/403 → 5min)
- 📊 **Token usage logs** — prompt/completion/total tokens tracked per key, including streaming responses; persisted to Postgres when Supabase is connected
- 🌐 **Manage providers from the web** — add/edit/disable/delete providers directly in the dashboard (Supabase required), no redeploy
- 🔐 **Single password login** — one `PASSWORD` env var for the dashboard, like 9Router; client API keys are created and revoked in the dashboard
- 🔌 **OpenAI-compatible API** — `POST /api/v1/chat/completions` (streaming SSE supported) and `GET /api/v1/models` work with any OpenAI client/SDK
- ☁️ **Vercel-ready** — Supabase (free tier) for persistence; works without a DB too (env-based config)
- 🤖 **Any OpenAI-compatible provider** — OpenAI, OpenRouter, DeepSeek, GLM, Moonshot, Groq, Together, Ollama, …

## Quick start (local)

```bash
npm install
cp .env.example .env   # then edit it
npm run dev            # http://localhost:3000
```

## Configuration

| Variable | Purpose |
|---|---|
| `PASSWORD` | Dashboard login password (the only required secret) |
| `SUPABASE_URL` | Supabase project URL — enables DB storage (recommended) |
| `SUPABASE_SERVICE_KEY` | Supabase `service_role` key — **server-side only, never expose** |
| `PROVIDERS_JSON` | Optional: providers without a DB, or import source for the DB |
| `ROUTER_API_KEY` | Optional fallback client key (prefer dashboard-created keys) |

### Supabase setup (5 min, free)

1. Create a project at [supabase.com](https://supabase.com).
2. In **SQL Editor**, paste and run `supabase/schema.sql` from this repo.
3. Copy **Project URL** and **service_role key** (Project Settings → API) into env vars.
4. Redeploy — Providers and API Keys pages become fully manageable from the web UI.

Without Supabase, providers come from `PROVIDERS_JSON` (read-only in the UI) and
client auth uses `ROUTER_API_KEY` (empty = open access).

Provider entry:

```json
{
  "name": "OpenRouter",
  "baseUrl": "https://openrouter.ai/api/v1",
  "apiKeys": ["sk-or-aaa", "sk-or-bbb"],
  "models": ["*"],
  "priority": 2,
  "enabled": true
}
```

- `apiKeys`: array of keys — requests rotate round-robin; failing keys cool down automatically. A single `apiKey` string also works.
- `models: ["*"]` accepts any model name (the router discovers the provider's catalogue for `/v1/models`).
- Lower `priority` is tried first.

## Use it from any OpenAI client

```python
from openai import OpenAI

client = OpenAI(
    base_url="https://YOUR-APP.vercel.app/api/v1",
    api_key="YOUR_ROUTER_API_KEY",
)
res = client.chat.completions.create(
    model="gpt-4o-mini",
    messages=[{"role": "user", "content": "Hello!"}],
)
```

```bash
curl https://YOUR-APP.vercel.app/api/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ROUTER_API_KEY" \
  -d '{"model":"gpt-4o-mini","messages":[{"role":"user","content":"hi"}]}'
```

## Deploy to Vercel

1. Push this repo to GitHub.
2. Import it at [vercel.com/new](https://vercel.com/new).
3. Add the environment variables above.
4. Deploy — done. Your router lives at `https://YOUR-APP.vercel.app`.

> Notes: request stats are in-memory per serverless instance (reset on cold start).
> `maxDuration` is 60s — long streaming generations on the Hobby plan may be cut off;
> upgrade to Pro for longer timeouts.

## API reference

| Method & path | Auth | Description |
|---|---|---|
| `POST /api/v1/chat/completions` | Bearer key | Chat completions with fallback, SSE streaming supported |
| `GET /api/v1/models` | Bearer key | Aggregated model list (OpenAI shape) |
| `GET /api/health` | none | Health check |

## License

MIT
