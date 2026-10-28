// The bindings wrangler.jsonc declares, as the Worker (and `next dev` through
// the platform proxy) sees them. Hand-typed rather than
// `@cloudflare/workers-types` as a global, whose `Body.json<T>()` merges ahead
// of lib.dom's and breaks untyped `res.json()` calls. @repo/rate-limit types
// its own slice of the namespace.
interface CloudflareEnv {
  RATE_LIMIT: unknown;
  ASSETS: { fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> };
}
