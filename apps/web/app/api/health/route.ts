import { getCloudflareContext } from "@opennextjs/cloudflare";

// Added for the deploy's smoke: answered only by this Worker, and only once
// its RATE_LIMIT namespace (the contact form's rate limit) is bound — a read
// of a key nobody writes.
export const dynamic = "force-dynamic";

export const GET = async (): Promise<Response> => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const kv = (env as { RATE_LIMIT?: { get(key: string): Promise<unknown> } })
      .RATE_LIMIT;
    if (!kv) {
      throw new Error("no RATE_LIMIT binding");
    }
    await kv.get("health");
    return Response.json({ ok: true });
  } catch (error) {
    console.error(error);
    return Response.json(
      { ok: false, error: "rate-limit namespace unreachable" },
      { status: 503 }
    );
  }
};
