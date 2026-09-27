# Build verification — 27 September 2026

Verified:
- Next.js production build and TypeScript compilation.
- ESLint: no errors or warnings.
- Desktop overview, chat navigation, and model settings in Chrome.
- Responsive chat layout at 395px width.
- Codex App Server starts with isolated credentials; bridge account endpoint responds.
- Bridge rejects invalid pairing tokens and foreign origins.
- Hosted page returns HTTP 200.

Pending:
- Supabase project provisioning: Vercel marketplace checkout requires approval of a recurring paid plan. No database resource has been created yet.
- Apply the migration and verify authentication, import persistence, workspace isolation, retrieval, and saved history against the live database.
- Complete a Codex account login and a model answer with user credentials; no model account was used during setup.
- Anthropic answer verification requires a user-supplied API key.
- Native source OAuth/synchronization adapters are extension points, not implemented integrations.

GitHub repository is private under how-to-ai-co. CLI deployment works. Automatic GitHub deployments are not connected: Vercel could not access the private organization repository with its current GitHub installation permissions.
