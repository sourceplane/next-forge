// The API Worker's entry (wrangler `main`). @opennextjs/cloudflare generates a
// worker that exports only `fetch`; this keeps that handler and adds the
// `scheduled` handler the Cron Trigger calls, as the adapter's custom-worker
// guide describes (https://opennext.js.org/cloudflare/howtos/custom-worker).
//
// Upstream's vercel.json ran GET /cron/keep-alive once a day; the Cron Trigger
// (wrangler.jsonc `triggers.crons`) runs the same route, through the same
// fetch handler, so the route stays the one place the work is.
// @ts-ignore -- `.open-next/worker.js` is generated at build time (an
// expect-error directive would be unused once it exists)
import { default as handler } from "./.open-next/worker.js";

// A Worker module exports handlers only, so the path is not exported.
const KEEP_ALIVE_PATH = "/cron/keep-alive";

const worker = {
  fetch: handler.fetch,
  async scheduled(
    _controller: ScheduledController,
    env: CloudflareEnv,
    ctx: ExecutionContext
  ) {
    const response = await handler.fetch(
      new Request(`https://cron.internal${KEEP_ALIVE_PATH}`, {
        headers: { "user-agent": "cloudflare-cron" },
      }),
      env,
      ctx
    );
    if (!response.ok) {
      throw new Error(`${KEEP_ALIVE_PATH} answered ${response.status}`);
    }
  },
} satisfies ExportedHandler<CloudflareEnv>;

export default worker;
