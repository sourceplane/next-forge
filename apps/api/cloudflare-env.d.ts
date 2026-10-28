// The bindings wrangler.jsonc declares, as the Worker (and `next dev` through
// the platform proxy) sees them, plus the slice of the Workers runtime the
// custom entry (worker.ts) uses. Hand-typed rather than
// `@cloudflare/workers-types` as a global, whose `Body.json<T>()` merges ahead
// of lib.dom's and breaks untyped `res.json()` calls.
interface CloudflareEnv {
  HYPERDRIVE: { connectionString: string };
  ASSETS: { fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

interface ScheduledController {
  readonly cron: string;
  readonly scheduledTime: number;
  noRetry(): void;
}

interface ExportedHandler<Env = unknown> {
  fetch?(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Response | Promise<Response>;
  scheduled?(
    controller: ScheduledController,
    env: Env,
    ctx: ExecutionContext
  ): void | Promise<void>;
}
