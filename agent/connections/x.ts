import { connect } from "@vercel/connect/eve";
import { defineMcpClientConnection } from "eve/connections";

/**
 * The X (Twitter) MCP connection — the heart of this template.
 *
 * X hosts a Streamable HTTP MCP server at https://api.x.com/mcp. There are three
 * realistic ways to authenticate to it (see https://docs.x.com/tools/mcp):
 *
 *   1. The `xurl` bridge — a *local* stdio process that runs an OAuth 2.0 PKCE
 *      login. Great for desktop clients (Cursor, Claude Desktop), but it cannot
 *      run inside a deployed web app, so we never use it here.
 *
 *   2. App-only Bearer (DEFAULT) — point an MCP client straight at the URL with
 *      a static `Authorization: Bearer <token>` header. Read-only, no user
 *      context (it can't post as anyone). Perfect for a public fact-checker.
 *
 *   3. Vercel Connect — let Vercel store the credential and hand the runtime a
 *      token at request time, so no secret lives in your env/repo. For this
 *      read-only fact-checker the clean fit is an **API key connector**: store
 *      the same app-only Bearer token in Connect and request it app-scoped.
 *      That is non-interactive (no OAuth consent, no callback, no per-user
 *      login), so it works with the public `none()` channel. (Use a Custom
 *      OAuth connector + user-scoped `connect(connector)` instead only when you
 *      want each visitor acting as their own X account, or write access.)
 *
 * This file switches between (2) and (3) based on env, so the default build
 * stays on the simple bearer token and flipping to Connect is one variable away.
 * See the "Using Vercel Connect" section of the README for the full setup.
 *
 * The filename gives this connection its runtime name, so discovered tools are
 * called by the model as `x__<tool>` (e.g. `x__search_posts_all`).
 */

// Set X_CONNECTOR to your Vercel Connect connector UID (e.g. "api.x.com/x-key")
// to use Vercel Connect. Leave it unset to use the static app-only Bearer token.
const connector = process.env.X_CONNECTOR;

export default defineMcpClientConnection({
  url: "https://api.x.com/mcp",
  description:
    "The X (Twitter) API. Use it to fact-check claims against what is actually posted on X: " +
    "search the full post archive, look up users by handle or id, fetch the content of a " +
    "specific post/tweet (including one the user linked), read a user's recent posts and " +
    "mentions, and pull X news stories and trends.",

  auth: connector
    ? // ── Option 3: Vercel Connect (app-scoped) ────────────────────────────
      //
      // App-scoped: Connect hands the runtime one shared credential for the
      // whole app, non-interactively. With an API key connector this is just the
      // stored Bearer token; eve sends it as `Authorization: Bearer <token>`,
      // exactly like option 2 — but the secret lives in Connect, not your env.
      // No OAuth, no callback, no user principal, so the public `none()` channel
      // is fine.
      //
      // For per-visitor X sign-in (Custom OAuth connector) use user-scoped
      // `connect(connector)` instead, and give agent/channels/eve.ts an auth
      // walk that returns `principalType: "user"`.
      connect({ connector, principalType: "app" })
    : // ── Option 2: App-only Bearer (default) ──────────────────────────────
      {
        getToken: async () => {
          // The app-only Bearer token from your X app's "Keys and tokens" page.
          // We accept the clean template name first, then fall back to the value
          // that ships in this repo's .env.local (XAI_TOKEN).
          //
          // Send the token exactly as it appears in the portal — do NOT URL-decode
          // it. X's token is accepted verbatim (decoding `%2B`/`%3D` yields a 401).
          const token = process.env.X_BEARER_TOKEN ?? process.env.XAI_TOKEN;
          if (!token) {
            throw new Error(
              "Missing X_BEARER_TOKEN. Add your X app-only Bearer token to .env.local " +
                "(see .env.example), or set X_CONNECTOR to use Vercel Connect.",
            );
          }
          return { token };
        },
      },

  // The X server exposes read tools and (with user context) write tools. Once
  // you've run `eve info` and seen the exact tool names, narrow the surface
  // explicitly, e.g.:
  //
  // tools: {
  //   allow: ["search_posts_all", "get_post", "get_user", "search_news", "get_trends"],
  // },
});
