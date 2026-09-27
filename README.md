# Company Brain

A Cortex company workspace for the How to AI community. Connect source records to Supabase, browse knowledge spaces, and ask business questions with your own model account.

## Run

```sh
npm install
cp .env.example .env.local
npm run dev
```

Create a Supabase project, put its URL and publishable/anon key in `.env.local`, and apply `supabase/migrations/202609270001_brain.sql` with the SQL editor or Supabase CLI. Enable email/password authentication. Set the Supabase Auth Site URL and allowed redirects to your deployment. Keep email confirmation enabled; production email delivery may require your own SMTP configuration.

Sign up, confirm your email, sign in, and create a workspace. Each account currently owns one private workspace; team membership and source-specific access controls are a future extension. RLS isolates all workspace records and history. No service-role key is used by the application.

## Connect a source

Sources are adapter slots, not preinstalled Slack/CRM/ERP OAuth integrations. Register a source, then import real normalized JSON in the UI or call `POST /api/ingest` with the signed-in user's Supabase access token as the Bearer token. Batch limit: 100 records. Re-importing a source/external ID updates the existing record.

```json
{
  "source": "source-uuid-from-the-ui",
  "records": [
    {
      "external_id": "your-system-record-id",
      "domain": "finance",
      "title": "Invoice 2026-042",
      "content": "The source record's actual text and figures.",
      "source_url": "https://your-source.example/record",
      "metadata": { "currency": "USD" }
    }
  ]
}
```

Domains: `company`, `finance`, `operations`, `inventory`, `sales`, `marketing`, `cx`. Your connector should fetch through the source's API/MCP, respect the importing user's access, normalize records, then post batches. Use short-lived session tokens; scheduled sync needs a deliberately scoped service identity. Source deletion cascades to records. Provider-side deletions and permissions changes must be propagated by your adapter.

Supabase is a shared query layer. Existing source systems remain authoritative. This starter uses Postgres full-text retrieval (20 matches; falls back to 20 recent scoped records). It is not a financial aggregation engine: large datasets, totals, reconciliations, and time-series metrics need structured domain tables and deterministic queries. No fabricated demo metrics are shown.

## Bring your model

### Anthropic

Open Ask your brain → Model settings. Paste your Anthropic API key and model ID. The key stays in browser memory, is forwarded through the app's server to Anthropic, and is never stored in Supabase. Refreshing clears it. API usage is billed separately from a Claude subscription. The selected records are sent to your chosen model provider. Default model ID is editable.

### Codex account

Install the official Codex CLI, then run locally:

```sh
npm run bridge -- --origin http://localhost:3000
# For the hosted app, use its exact HTTPS origin instead.
```

Paste the pairing token shown by the bridge into Model settings, choose Sign in with Codex, finish the official browser login, and Check connection. The bridge uses Codex App Server's account login flow; it does not copy your existing Codex credentials. Credentials are stored in `~/.company-brain-codex`, with an isolated empty working directory. Keep the bridge running. Browser local-network permissions may be required for a hosted origin. The bridge accepts only its configured Origin and a random per-run pairing token, and listens only on loopback. Do not expose it publicly.

Codex integration is a starter integration with an evolving App Server protocol. It requests a read-only sandbox, disables shell tools/web search, and rejects approval/tool requests. Verify compatibility with your installed Codex version before sharing deployment. Hosted login alone cannot access a user's local Codex account without this companion bridge.

## Extend

- Add adapters for Slack, Drive, ERP/accounting, CRM, support, and social.
- Add structured finance/inventory tables and deterministic tools before promising exact aggregate answers.
- Add team membership, roles, and document-level permission propagation before importing private shared company data.
- Add provider sync jobs, cursor tracking, retries, deletions, and audit logs.
- Add a bounded multi-turn retrieval strategy; current questions are answered independently, with chat history saved for display.

## Validation

```sh
npm run lint
npm run build
```

Do not commit `.env.local`, API keys, access tokens, or bridge credentials. This repository includes no synthetic company dataset. Empty views are intentional scaffolds for your community's future tools.
