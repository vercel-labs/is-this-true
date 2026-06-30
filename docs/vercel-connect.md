# Using Vercel Connect

By default this template reads the X Bearer token from an env var
(`X_BEARER_TOKEN`). With [Vercel Connect](https://vercel.com/docs/connect) the
credential lives in Connect instead — your runtime fetches a token at request time, so
**no secret sits in your env or repo**, and you get managed storage, per-project/per-
environment scoping, and rotation.

The connection in `agent/connections/x.ts` already supports this: set `X_CONNECTOR` to
your connector UID and it uses Connect; leave it unset and it uses the static token.

## Which connector type?

For this app you want an **API-key connector**. It stores your existing app-only
Bearer token and hands it back app-scoped — non-interactive, no OAuth, no callback, no
per-user login. It composes with the public `none()` channel and needs no extra code.

> **You do not need OAuth here.** A "Custom OAuth" connector exists for letting each
> visitor sign in as *their own* X account (and for write actions like bookmarks/
> Articles). This fact-checker is read-only and acts as one account, so OAuth adds a
> lot of setup for zero benefit. See [Per-user OAuth](#per-user-oauth-not-needed-here)
> only if you genuinely need per-visitor identity.

## Setup (API-key connector)

### 1. Link the project

```bash
npm install @vercel/connect   # already a dependency in this template
vercel link
```

### 2. Create the connector

Store your X app-only Bearer token in Connect.

**Dashboard:** Connect → **Create connector** → **API Key**, service `api.x.com`, name
`x-key`, paste the token.

**Or CLI** (headless):

```bash
vercel connect create api.x.com --connector-type api-key --name x-key \
  --data '{"values":[{"key":"apiKey","value":"YOUR_X_BEARER_TOKEN"}]}'
```

The connector UID is `api.x.com/x-key`. Confirm it's attached to the project (CLI
create usually auto-attaches):

```bash
vercel connect attach api.x.com/x-key --yes
vercel connect list
```

### 3. Point the app at it

The connection is already wired to switch on `X_CONNECTOR`:

```ts
// agent/connections/x.ts (already in the template)
const connector = process.env.X_CONNECTOR;

export default defineMcpClientConnection({
  url: "https://api.x.com/mcp",
  description: "The X API. Search posts, look up users, fetch tweets, news, and trends.",
  auth: connector
    ? connect({ connector, principalType: "app" }) // Vercel Connect (app-scoped)
    : { getToken: async () => ({ token: process.env.X_BEARER_TOKEN! }) }, // static token
});
```

Set the env var (and unset/remove `X_BEARER_TOKEN` — it's no longer needed):

```bash
# .env.local (local dev)
X_CONNECTOR="api.x.com/x-key"
```

### 4. Deploy

```bash
vercel env add X_CONNECTOR        # value: api.x.com/x-key, all environments
vercel deploy --prod
```

Local dev authenticates to Connect with the OIDC token from `vercel env pull`; on
Vercel it's automatic.

## Verify

Run `npm run dev` (or hit the deployed app) and fact-check something. In the eve dev
output you should see `connection_search` return the X tools (e.g. `Search Posts All`)
and the agent call `x__search_posts_all` — no authorization prompt. If you instead see
`needsAuthorization: true` and no tools, the connector token isn't resolving (see
below).

## Troubleshooting

| Symptom | Likely cause / fix |
| --- | --- |
| `connection_search` returns the connection but **no tools**, `needsAuthorization: true` | The connector can't issue a token for the project. Check `vercel connect list` shows it attached, that the API-key value is correct, and that `X_CONNECTOR` matches the UID exactly. |
| `Token subject is not accessible to this requester` (CLI) | You're requesting via your user session; the project (OIDC) is the real requester at runtime. Verify the connector is attached and the value is set. |
| Works locally, fails on deploy | Pull a fresh OIDC token (`vercel env pull`) and confirm the connector is attached for the deployed **environment** (production/preview). |

## Per-user OAuth (not needed here)

If you want each visitor acting as their own X account, or write access, you'd use a
**Custom OAuth** connector and user-scoped auth instead:

1. Enable OAuth 2.0 on your X app (Confidential client); copy Client ID/Secret.
2. Create a Custom OAuth connector (service `api.x.com`, Authorization URL
   `https://x.com/i/oauth2/authorize`, Token URL `https://api.x.com/2/oauth2/token`,
   scopes `tweet.read users.read offline.access`, `+ bookmark.*` for writes).
3. Register the connector's callback URL in your X app's OAuth2 redirect URIs.
4. Use user-scoped auth: `connect(process.env.X_CONNECTOR)` (drop `principalType`).
5. Give `agent/channels/eve.ts` an auth walk that returns `principalType: "user"`
   (the public `none()` channel fails user-scoped Connect with `principal_required`).

This path also requires the OAuth callback to be publicly reachable (Vercel Deployment
Protection / SSO will break it). For a read-only single-account fact-checker, prefer
the API-key connector above.
