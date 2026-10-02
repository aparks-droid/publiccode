# Instinct website reader

- Endpoint: `GET https://company-brain-drab.vercel.app/api/instinct`
- Header: `Authorization: Bearer YOUR_INSTINCT_API_KEY`
- Response: the same JSON snapshot as the hosted website's `/api/brain`, including company, sources, records and attention items.

The hosted website currently displays the bundled Driftwood sample company. The response includes `demo: true`; it is not live business data. This integration is read-only and requires no database or AI credentials. Other HTTP methods are unsupported.

The key is private. Only its SHA-256 hexadecimal digest is configured server-side as `INSTINCT_KEY_HASH` in Vercel. Set or replace that value and redeploy to activate or rotate a key. Remove it and redeploy to disable access. Never put the raw key in client code or Git.

Import `instinct.openapi.json` if Instinct accepts OpenAPI; configure Bearer authentication separately. Missing or invalid keys return 401. Missing server configuration returns 503.
