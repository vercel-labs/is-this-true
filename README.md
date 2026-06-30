# is this true?

A small template showing how to use the **[X (Twitter) MCP](https://docs.x.com/tools/mcp)**
from an [eve](https://www.npmjs.com/package/eve) agent.

Paste a tweet link or type a claim, and the agent fact-checks it against what's
actually posted on X, then returns a structured verdict card. It's the
"@grok is this true?" reply, as a web app.

## How it works

```
Browser (Next.js)  ──►  eve agent  ──►  X MCP (https://api.x.com/mcp)
   single input          model loop        search posts, look up users,
   verdict card          + outputSchema     fetch tweets, news, trends
```

1. The browser sends the claim with a per-turn **output schema** (`lib/verdict.ts`),
   so the model must return a structured verdict.
2. The agent uses the **X MCP connection** (`agent/connections/x.ts`) to search the X
   archive, fetch a linked post, look up users, and read news/trends.
3. The UI (`app/_components/is-this-true.tsx`) renders the verdict, confidence, and the
   cited X posts, with the original tweet embedded when you paste a link.

### The X MCP connection

X hosts a Streamable HTTP MCP server at `https://api.x.com/mcp`. A deployed web app
reaches it with an **app-only Bearer token** sent as `Authorization: Bearer <token>`
— read-only access (search posts, look up users/tweets, news, trends), which is
exactly what fact-checking needs. (X's other route, the local `xurl` stdio bridge, is
for desktop clients like Cursor and can't run in a deployed app.)

eve just needs that token. You can give it to eve **two ways**, and the connection
already supports both via the `X_CONNECTOR` env var:

| | How the token is provided | Setup |
| --- | --- | --- |
| **A. Static credential** (default) | `X_BEARER_TOKEN` env var | [below](#option-a-static-credential-default) |
| **B. Vercel Connect** | Stored in Connect, fetched at runtime (no secret in your env) | [docs/vercel-connect.md](docs/vercel-connect.md) |

Either way the token never reaches the model — eve resolves it per step and the model
only sees the discovered tools as `x__<tool>`.

## Prerequisites

- **Node 24+**
- An **X developer app** with an app-only **Bearer token**
  ([X Developer Portal](https://developer.x.com) → your app → *Keys and tokens* →
  *Bearer Token*).
- A **model credential** for the eve agent (routes through the Vercel AI Gateway):
  either `AI_GATEWAY_API_KEY`, or a `VERCEL_OIDC_TOKEN` from `vercel link && vercel env pull`.

## Setup

```bash
npm install
cp .env.example .env.local
```

Then pick one of the two options below and set the matching env var(s).

### Option A: Static credential (default)

Put your X Bearer token in `.env.local`:

```bash
# .env.local
X_BEARER_TOKEN="AAAAAAAAAAAA...your X app-only Bearer token..."
```

> Paste the token **exactly** as the portal shows it. Don't URL-decode it — X accepts
> the verbatim value, and decoding `%2B`/`%3D` yields a 401.

That's it. The connection (`agent/connections/x.ts`) reads `X_BEARER_TOKEN` and sends
it as the Bearer token.

### Option B: Vercel Connect

Store the token in [Vercel Connect](https://vercel.com/docs/connect) instead, so no
secret lives in your env/repo. For this read-only app the right Connect primitive is an
**API-key connector** (app-scoped, non-interactive). Full walkthrough:

**→ [docs/vercel-connect.md](docs/vercel-connect.md)**

Short version: create an API-key connector holding your Bearer token, then set
`X_CONNECTOR="api.x.com/x-key"` instead of `X_BEARER_TOKEN`. The connection switches to
Connect automatically.

## Run it

```bash
npm run dev
```

Open the app, paste a tweet or type a claim, and watch it check X.

## Deploy

This deploys to Vercel as one project (Next.js app + eve runtime):

```bash
# Option A (static credential):
vercel env add X_BEARER_TOKEN     # paste your token, all environments
vercel deploy --prod

# Option B (Vercel Connect): see docs/vercel-connect.md, then
vercel env add X_CONNECTOR        # value: api.x.com/x-key
vercel deploy --prod
```

> **Public demo:** `agent/channels/eve.ts` uses `none()`, so the deployed endpoint is
> open — anyone can use it and every request spends your X rate limits and AI tokens.
> For more than a demo, replace `none()` with real auth (Auth.js, Clerk, …); see
> `node_modules/eve/docs/guides/auth-and-route-protection.md`. Also note Vercel
> **Deployment Protection** (SSO) will gate the whole site if enabled — turn it off for
> a truly public demo.

## Make it yours

- **Narrow the X tools** the model can call: run `eve info` to see the exact tool
  names, then set `tools.allow` in `agent/connections/x.ts`.
- **Change the verdict shape**: edit `lib/verdict.ts` (the schema is shared by the
  agent and the UI).
- **Tune the behavior**: edit `agent/instructions.md`.

## Caveats

- Verdicts are based on **evidence found on X**, not absolute ground truth — the X API
  tells you what's on X, not what's objectively correct.
- The app-only Bearer token is read-only and has no user context (it can't post).
- This is an automated AI fact-check and can be wrong.
