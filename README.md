# Company Brain

A local, customizable business workspace for the How to AI community. Connect Slack, Attio and Stripe to **your own Supabase project**, then use your own OpenAI or Anthropic API key to ask questions and surface issues across the records.

The [hosted site](https://company-brain-drab.vercel.app/) is a sample preview. Everyone runs their own copy locally; there is no shared company database or subscription-login bridge.

## Start here

You need Node.js 22 or later, access to this repository, and your own Supabase project.

```sh
git clone https://github.com/how-to-ai-co/company-brain.git
cd company-brain
npm install
npm run dev
```

Open **http://127.0.0.1:3000**. The app and its local monitor start together. No Vercel deployment or environment-file editing is needed.

1. **Connect your database.** Create your own Supabase project. Run [`supabase/setup.sql`](supabase/setup.sql) in its SQL editor once. Enter its project URL and secret key (or legacy `service_role` key) in the app's setup form. The app verifies the schema and privileged key before saving it. Never use the instructor's project.
2. **Connect a source.** Open Sources → Connect Slack, Attio or Stripe. Follow the short instructions, enter the source token, and choose **Connect & sync**. A connection counts as successful only after a real API read and database save.
3. **Connect AI.** Choose Use ChatGPT (OpenAI API key) or Use Claude Code (Anthropic API key). These call the provider APIs, not subscription apps. Anthropic keys should have Scope set to Default workspace or another workspace. API billing is separate from a subscription.
4. **Ask and inspect.** Ask a question that the imported records can answer. Review the cited source records. Use Analyze to populate Attention.
5. **Optionally keep watch.** In Sources, describe what should get attention, choose an interval, and enable automatic checks. These use your saved AI key and API billing. Your computer and app must remain running; the browser can be closed. Closing the app stops checks.

If you want to explore first, **Load sample company** adds invented Driftwood Coffee Roasters records to an otherwise empty workspace. Once you connect a real source, sample records are excluded from the UI and AI analysis. Loading samples never replaces real company data.

For a guided coding-agent workflow, use [`class/build-recipe.md`](class/build-recipe.md).

## Connect Instinct

Instinct can read the same bundled data shown on the hosted website through `GET /api/instinct` with a Bearer API key. This read-only endpoint needs no database or AI credentials. See [`INSTINCT.md`](INSTINCT.md) for setup and the [`OpenAPI schema`](instinct.openapi.json).

## What each connection imports

| Source | Credential | Current scope |
| --- | --- | --- |
| Slack | Your workspace's bot token | Last 30 days from up to 20 joined public/private channels, up to 300 top-level messages per channel. Thread replies are not included. |
| Attio | API key with `record_permission:read` and `object_configuration:read` | Up to 1,000 records from the standard Deals object. Source stages and attributes are preserved. |
| Stripe | Restricted key with Charges read permission | Up to 1,000 charge attempts from the last 90 days, including failed charges and refunds. Test keys read test data. |
| Other tools | Your adapter or export | Import up to 100 normalized JSON records at a time. |

Adapters are read-only toward source services. Each successful sync atomically replaces that source's **bounded snapshot** in Supabase; updates and deletions within that snapshot are reflected without duplicating IDs. Failures preserve the previous snapshot. This is a working starter, not full-history ingestion: private-channel permissions, source retention, pagination caps, and missing Slack thread replies limit coverage. Source cards show their coverage and last sync/error.

Slack setup: create an internal app, add bot scopes `channels:read`, `channels:history`, `groups:read`, `groups:history`, install it in your workspace, then invite it to each selected channel. [Slack API documentation](https://docs.slack.dev/reference/methods/conversations.history/).

Attio: Settings → Developers → API key; enable the read scopes above and ensure Deals exists. [Attio deal records API](https://docs.attio.com/rest-api/endpoint-reference/standard-objects/deals/list-deal-records).

Stripe: create a restricted key with Charges read access. [Stripe Charges API](https://docs.stripe.com/api/charges/list).

## How the brain works

**Sources → Supabase records → retrieval / attention analysis → Home, Attention and chat.**

Chat searches Postgres full text, expands across departments when the initial search cap is hit, and falls back to recent records. It sends bounded evidence plus up to 12 conversation turns to the selected provider. This is evidence retrieval, not an exact accounting engine.

Attention sends up to 400 recent records plus your attention guidelines to the model. It requires supporting record IDs, groups related issues, and saves a new analysis before removing old open issues. Resolved issues with identical category/evidence are suppressed. These are AI judgements, not a deterministic rules engine. Review priorities and cited evidence before acting.

Automatic checks refresh connected sources first. If a source fails, existing attention items are kept rather than presenting a fresh all-company analysis. When enabled, analysis runs when data/guidelines change or a new UTC day begins. Monitor status, source errors, and analysis errors appear in Sources. If you restart the app, the next enabled check runs again; it does not replay every missed interval.

## Your credentials and data

- `.company-brain/connections.json` holds your local database, source and AI credentials. The folder is ignored by Git, with owner-only filesystem permissions. These are local plaintext secrets; protect your computer and don't share this folder.
- Database and source keys never return to the browser. The local server connects to your Supabase project with a secret/service-role key. Database RLS denies anonymous browser access. The AI sees retrieved record content only when you ask/analyze or enable checks.
- The launcher binds to `127.0.0.1`. Sensitive routes also reject remote hosts, cross-origin requests and non-JSON mutations. This is a single-person local application. Do not expose it through a tunnel or use it as a multi-user hosted service without adding authentication and authorization.
- Deployments on Vercel automatically show only the bundled sample preview. They do not read local credentials or connect to company data.
- Disconnect removes a saved source credential; existing imported records remain. Disconnect AI removes its saved key and stops future model calls from automatic checks.

Existing installations: apply only the migrations you have not applied, in order. `20261002000100_local_private.sql` replaces the old open-workspace access with server-only access and adds atomic source sync. Existing records are preserved. Then use the local setup form with a secret/service-role key. Do not rerun the complete fresh-install SQL on an existing schema.

## Customize

Use Codex or Claude Code in this folder and ask it to extend your copy. Useful entry points:

- `src/lib/server/connectors.ts`: add read adapters; return stable external IDs, text, metadata and original URLs.
- `src/lib/server/sync.ts`: persist normalized source snapshots.
- `src/app/api/analyze/route.ts`: attention criteria and evidence validation.
- `src/app/api/chat/route.ts`: retrieval and questions.
- `src/components/brain/`: Home, Attention, Sources, chat and department views.
- `scripts/monitor.mjs`: recurring local checks.

Finance totals across currencies, invoice-level accounting, full CRM relationships, Slack replies, document access propagation, team accounts and arbitrary ERP connections are further development work. Do not represent them as included connectors.

## Verify

```sh
npm test
npm run lint
npm run build
```

Tests cover both AI providers with simulated API responses, source adapters, local credential persistence, request isolation, a fresh Postgres schema, access policies, atomic sync and retrieval. Live account verification requires the owner's own source credentials and AI key; passing fixture tests is not a claim that someone's account is connected. See [`VERIFICATION.md`](VERIFICATION.md).
