// Stands in for @opennextjs/cloudflare's generated worker in worker.ts's
// suite: the fetch handler the Cron Trigger's scheduled handler calls.
export const requests: Request[] = [];
export const state = { status: 200 };

export default {
  async fetch(request: Request): Promise<Response> {
    requests.push(request);
    return new Response("OK", { status: state.status });
  },
};
