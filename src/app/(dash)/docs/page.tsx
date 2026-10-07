import CopyButton from "@/components/CopyButton";

const PROVIDERS_EXAMPLE = `[
  {
    "name": "OpenAI",
    "baseUrl": "https://api.openai.com/v1",
    "apiKeys": ["sk-aaa", "sk-bbb", "sk-ccc"],
    "models": ["gpt-4o-mini", "gpt-4o"],
    "priority": 1,
    "enabled": true
  },
  {
    "name": "OpenRouter",
    "baseUrl": "https://openrouter.ai/api/v1",
    "apiKey": "sk-or-...",
    "models": ["*"],
    "priority": 2,
    "enabled": true
  }
]`;

export default function DocsPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="mb-1 text-2xl font-bold">Docs</h1>
      <p className="mb-6 text-sm text-zinc-500">Setup, configuration, and client integration.</p>

      <section className="card mb-6">
        <h2 className="mb-2 text-lg font-semibold">1. Environment variables</h2>
        <p className="mb-3 text-sm text-zinc-400">
          Only <b>one password</b> is required. Providers and client API keys are managed
          right in this dashboard when a database is connected. On Vercel, set variables under
          Project → Settings → Environment Variables.
        </p>
        <table className="mb-4 w-full text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-800 text-xs uppercase text-zinc-500">
              <th className="py-2 pr-4">Variable</th>
              <th className="py-2">Purpose</th>
            </tr>
          </thead>
          <tbody className="text-zinc-300">
            <tr className="border-b border-zinc-800/50">
              <td className="py-2 pr-4 font-mono text-xs text-emerald-300">PASSWORD</td>
              <td className="py-2 text-xs">Dashboard login password (required). Also accepts DASHBOARD_PASSWORD.</td>
            </tr>
            <tr className="border-b border-zinc-800/50">
              <td className="py-2 pr-4 font-mono text-xs text-emerald-300">SUPABASE_URL</td>
              <td className="py-2 text-xs">Supabase project URL — enables DB storage (recommended).</td>
            </tr>
            <tr className="border-b border-zinc-800/50">
              <td className="py-2 pr-4 font-mono text-xs text-emerald-300">SUPABASE_SERVICE_KEY</td>
              <td className="py-2 text-xs">Supabase <b>service_role</b> key (server-side only, never expose).</td>
            </tr>
            <tr className="border-b border-zinc-800/50">
              <td className="py-2 pr-4 font-mono text-xs text-emerald-300">PROVIDERS_JSON</td>
              <td className="py-2 text-xs">Optional: seed providers without a DB, or import into DB from the Providers page.</td>
            </tr>
            <tr>
              <td className="py-2 pr-4 font-mono text-xs text-emerald-300">ROUTER_API_KEY</td>
              <td className="py-2 text-xs">Optional fallback client key. Prefer creating keys in the dashboard.</td>
            </tr>
          </tbody>
        </table>

        <h3 className="mb-2 font-semibold text-zinc-200">Supabase setup (5 minutes)</h3>
        <ol className="mb-4 list-decimal space-y-1 pl-5 text-sm text-zinc-300">
          <li>Create a free project at <a href="https://supabase.com" target="_blank" rel="noreferrer" className="text-accent underline">supabase.com</a>.</li>
          <li>Open <b>SQL Editor</b> → paste the contents of <code className="inline">supabase/schema.sql</code> from this repo → Run.</li>
          <li>Copy <b>Project URL</b> and <b>service_role key</b> (Project Settings → API) into your env vars.</li>
          <li>Redeploy. The Providers and API Keys pages become fully manageable from the web.</li>
        </ol>

        <div className="mb-2 flex items-center justify-between">
          <div className="label mb-0">PROVIDERS_JSON format (env fallback / import source)</div>
          <CopyButton text={PROVIDERS_EXAMPLE} />
        </div>
        <pre className="code">{PROVIDERS_EXAMPLE}</pre>
      </section>

      <section className="card mb-6">
        <h2 className="mb-2 text-lg font-semibold">2. API reference</h2>
        <div className="space-y-3 text-sm">
          <div>
            <code className="inline">POST /api/v1/chat/completions</code>
            <p className="mt-1 text-xs text-zinc-400">
              OpenAI-compatible. Supports <code className="inline">stream: true</code> (SSE). Falls back
              across providers on 429 / 5xx / network errors.
            </p>
          </div>
          <div>
            <code className="inline">GET /api/v1/models</code>
            <p className="mt-1 text-xs text-zinc-400">Aggregated model list from all enabled providers.</p>
          </div>
          <div>
            <code className="inline">GET /api/health</code>
            <p className="mt-1 text-xs text-zinc-400">Health check — no auth required.</p>
          </div>
        </div>
      </section>

      <section className="card mb-6">
        <h2 className="mb-2 text-lg font-semibold">3. Connect a client</h2>
        <p className="mb-2 text-sm text-zinc-400">Any OpenAI SDK works — just point it at the router:</p>
        <pre className="code">{`from openai import OpenAI

client = OpenAI(
    base_url="https://YOUR-APP.vercel.app/api/v1",
    api_key="YOUR_ROUTER_API_KEY",
)

res = client.chat.completions.create(
    model="gpt-4o-mini",
    messages=[{"role": "user", "content": "Hello!"}],
)
print(res.choices[0].message.content)`}</pre>
      </section>

      <section className="card">
        <h2 className="mb-2 text-lg font-semibold">4. Deploy to Vercel</h2>
        <ol className="list-decimal space-y-2 pl-5 text-sm text-zinc-300">
          <li>Push this repo to GitHub.</li>
          <li>On <a href="https://vercel.com/new" target="_blank" rel="noreferrer" className="text-accent underline">vercel.com/new</a>, import the repo.</li>
          <li>Add the environment variables above, then Deploy.</li>
          <li>Open <code className="inline">https://YOUR-APP.vercel.app</code> — done.</li>
        </ol>
        <p className="mt-3 text-xs text-zinc-500">
          Note: request stats are in-memory per serverless instance (they reset on cold starts).
          Provider config comes from env vars, so changes need a redeploy (or update env + redeploy via Vercel).
        </p>
      </section>
    </div>
  );
}
