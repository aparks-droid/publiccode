# Local starter verification — 1 October 2026

## Confirmed

- 26 automated tests pass: both AI API paths, evidence and conversation handling, provider failures, local-key persistence, origin/host protection, Slack/Attio/Stripe pagination and normalization, and Postgres migration/access/snapshot behavior.
- A clean export of the exact GitHub release files passes npm ci, all 26 tests, lint, and a production build, without instructor credentials or untracked files.
- Desktop and 390px-wide source connection forms were reviewed in the browser.
- Live Supabase: applied the private local-server migration to the existing Company Brain project. Its 130 records, 3 sources, 6 issues and company workspace were preserved. An anonymous query returns zero records.
- Live Supabase write path: a disposable workspace/source was created, a snapshot saved, full-text evidence retrieved, and the same external ID updated without duplication. The disposable workspace was removed afterward.
- Local browser: database records load; source credential dialogs render; the actual Slack API rejects an invalid test token with an actionable inline error. No invalid token is saved. A localhost/127.0.0.1 origin mismatch found during this test was fixed and added to request-guard coverage.
- The local app launcher starts a separate monitor process. An enabled scheduled check completed against the live database and correctly skipped AI because no key was connected. Sources displayed the timestamp and missing-key explanation. Automatic checks were returned to off after this test.
- Vercel serves only the bundled sample preview, with a repo/recipe link. It no longer depends on an open company database.

## Still requires owner credentials

- A successful read from a real Slack, Attio or Stripe account. Adapter tests use representative provider responses. An invalid-token check proves the request/error path, not a successful import.
- A successful real OpenAI or Anthropic answer through this local saved-key flow. Provider tests simulate replies.
- A complete unattended cycle with real sources and an AI key. The worker can run independently of the browser; useful analysis still depends on those connections.

These are not claims that a community member's account is connected. Follow the build recipe's real-record question and citation check for each installation.

## Distribution

The repo is private at https://github.com/how-to-ai-co/company-brain. Members need access to clone it. No visibility change was made.

Use `npm test`, `npm run lint`, and `npm run build` for local checks. After connecting your database, `node scripts/verify-database.mjs` verifies actual Supabase persistence/retrieval in a disposable workspace, then removes only that workspace. It never prints credentials.
