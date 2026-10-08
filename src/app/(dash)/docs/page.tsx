import CopyButton from "@/components/CopyButton";
import Card from "@/components/Card";

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
      <div className="anim-fade-up mb-6">
        <h1 className="section-title">Docs</h1>
        <p className="section-sub">Setup, configuration, and client integration.</p>
      </div>

      <div className="stagger flex flex-col gap-6">
        <Card title="1. Environment variables" icon="settings">
          <p className="mb-4 text-sm text-[var(--text-muted)]">
            Only <b className="text-[var(--text)]">one password</b> is required. Providers and client API keys are managed
            right in this dashboard when a database is connected. On Vercel, set variables under
            Project → Settings → Environment Variables.
          </p>
          <div className="table-wrap mb-4">
            <table>
              <thead>
                <tr>
                  <th>Variable</th>
                  <th>Purpose</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["PASSWORD", "Dashboard login password (required). Also accepts DASHBOARD_PASSWORD."],
                  ["SUPABASE_URL", "Supabase project URL — enables DB storage (recommended)."],
                  ["SUPABASE_SERVICE_KEY", "Supabase service_role key (server-side only, never expose)."],
                  ["PROVIDERS_JSON", "Optional: seed providers without a DB, or import into DB from the Providers page."],
                  ["ROUTER_API_KEY", "Optional fallback client key. Prefer creating keys in the dashboard."],
                ].map(([v, d]) => (
                  <tr key={v}>
                    <td><code className="inline">{v}</code></td>
                    <td className="text-xs text-[var(--text-muted)]">{d}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3 className="mb-2 font-semibold">Supabase setup (5 minutes)</h3>
          <ol className="mb-4 list-decimal space-y-1 pl-5 text-sm text-[var(--text-muted)]">
            <li>Create a free project at <a href="https://supabase.com" target="_blank" rel="noreferrer" className="text-[var(--brand)] underline">supabase.com</a>.</li>
            <li>Open <b>SQL Editor</b> → paste the contents of <code className="inline">supabase/schema.sql</code> from this repo → Run.</li>
            <li>Copy <b>Project URL</b> and <b>service_role key</b> (Project Settings → API) into your env vars.</li>
            <li>Redeploy. The Providers and API Keys pages become fully manageable from the web.</li>
          </ol>

          <div className="mb-2 flex items-center justify-between">
            <div className="label !mb-0">PROVIDERS_JSON format (env fallback / import source)</div>
            <CopyButton text={PROVIDERS_EXAMPLE} />
          </div>
          <pre className="code">{PROVIDERS_EXAMPLE}</pre>
        </Card>

        <Card title="2. API reference" icon="api">
          <div className="space-y-4 text-sm">
            <div>
              <code className="inline">POST /api/v1/chat/completions</code>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                OpenAI-compatible. Supports <code className="inline">stream: true</code> (SSE). Falls back
                across providers on 429 / 5xx / network errors.
              </p>
            </div>
            <div>
              <code className="inline">GET /api/v1/models</code>
              <p className="mt-1 text-xs text-[var(--text-muted)]">Aggregated model list from all enabled providers.</p>
            </div>
            <div>
              <code className="inline">GET /api/health</code>
              <p className="mt-1 text-xs text-[var(--text-muted)]">Health check — no auth required.</p>
            </div>
          </div>
        </Card>

        <Card title="3. Connect a client" icon="terminal">
          <p className="mb-2 text-sm text-[var(--text-muted)]">Any OpenAI SDK works — just point it at the router:</p>
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
        </Card>

        <Card title="4. Connect Hermes" icon="terminal">
          <p className="mb-3 text-sm text-[var(--text-muted)]">
            Yes — Hermes works with nimi-router. It supports a custom OpenAI-compatible provider.
            Edit <code className="inline">~/.hermes/config.yaml</code>:
          </p>
          <pre className="code">{`model:
  default: "gpt-4o-mini"   # any model your providers serve
  provider: "custom"
  base_url: "https://YOUR-APP.vercel.app/api/v1"
  api_key: \${OPENAI_API_KEY}`}</pre>
          <p className="mb-2 mt-4 text-sm text-[var(--text-muted)]">
            Then put your nimi-router API key (create one on the Endpoint & Key page) in{" "}
            <code className="inline">~/.hermes/.env</code>:
          </p>
          <pre className="code">{`OPENAI_API_KEY=nimi_your_key_here`}</pre>
          <p className="mt-3 text-xs text-[var(--text-subtle)]">
            Hermes will route through nimi-router with full fallback across your providers.
            Any other OpenAI-compatible client (Claude Code, Cline, OpenCode, …) connects the same way:
            base URL + Bearer key.
          </p>
        </Card>

        <Card title="5. Deploy to Vercel" icon="rocket_launch">
          <ol className="list-decimal space-y-2 pl-5 text-sm text-[var(--text-muted)]">
            <li>Push this repo to GitHub.</li>
            <li>On <a href="https://vercel.com/new" target="_blank" rel="noreferrer" className="text-[var(--brand)] underline">vercel.com/new</a>, import the repo.</li>
            <li>Add the environment variables above, then Deploy.</li>
            <li>Open <code className="inline">https://YOUR-APP.vercel.app</code> — done.</li>
          </ol>
          <p className="mt-3 text-xs text-[var(--text-subtle)]">
            Note: request stats are in-memory per serverless instance (they reset on cold starts).
            Provider config comes from env vars, so changes need a redeploy (or update env + redeploy via Vercel).
          </p>
        </Card>
      </div>
    </div>
  );
}
