import { none } from "eve/channels/auth";
import { eveChannel } from "eve/channels/eve";

// PUBLIC DEMO: this agent endpoint is open to anyone. Every request spends your
// X API rate limits and your AI model tokens. For anything beyond a demo,
// replace `none()` with your app's real auth (e.g. Auth.js or Clerk) plus
// `vercelOidc()` / `localDev()` from "eve/channels/auth" — see
// node_modules/eve/docs/guides/auth-and-route-protection.md.
//
// Both auth modes in agent/connections/x.ts (static bearer, and Vercel Connect
// app-scoped via an API key connector) are app-scoped, so no user principal is
// required and `none()` is enough. Only per-user Vercel Connect OAuth would need
// a real user principal here.
export default eveChannel({
  auth: [none()],
});
