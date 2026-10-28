// Upstream logs through BetterStack (`@logtail/next`) in production. On
// Cloudflare a Worker's console is Workers Logs (wrangler.jsonc
// `observability`), queryable in the dashboard and drained to any log
// service from there, so `log` is the console.
export const log = console;
