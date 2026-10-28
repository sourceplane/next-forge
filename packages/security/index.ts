// Upstream's bot detection and shield are Arcjet's (`@arcjet/next`), whose
// request analyzer is a 3.6 MB WebAssembly module and whose transport needs
// Node's http2: neither fits a Worker (Workers Free takes 3 MiB compressed
// for the whole app). On Cloudflare the same protections are the edge's own,
// configured on the zone once a custom domain is attached — WAF managed
// rules for the shield, Bot Fight Mode or Super Bot Fight Mode for bots, and
// rate limiting rules — with nothing in the Worker. This package keeps the
// security headers (./proxy.ts).
export {};
