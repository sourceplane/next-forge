import { getCloudflareContext } from "@opennextjs/cloudflare";

// Upstash's sliding-window rate limit over Redis, upstream, is the same
// algorithm over Workers KV here: the web Worker's RATE_LIMIT namespace
// (apps/web/wrangler.template.jsonc), one per environment from Terraform
// (infra/terraform/cloudflare-kv). The API is upstream's —
// `createRateLimiter({ limiter: slidingWindow(1, "1d") }).limit(key)` — and
// so is the window: the request count of the current fixed window plus the
// previous window's, weighted by how much of it the sliding window still
// covers.
//
// KV is eventually consistent and takes one write per key per second, so the
// count is approximate under bursts from one key; a contact form's daily
// window per IP is far inside both.

type Unit = "ms" | "s" | "m" | "h" | "d";
export type Duration = `${number} ${Unit}` | `${number}${Unit}`;

const UNIT_MS: Record<Unit, number> = {
  ms: 1,
  s: 1000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
};

export const toMilliseconds = (duration: Duration): number => {
  const match = /^(\d+)\s*(ms|s|m|h|d)$/.exec(duration);
  if (!match) {
    throw new Error(`Unable to parse window size: ${duration}`);
  }
  return Number(match[1]) * UNIT_MS[match[2] as Unit];
};

export interface Limiter {
  tokens: number;
  windowMs: number;
}

export const slidingWindow = (tokens: number, window: Duration): Limiter => ({
  tokens,
  windowMs: toMilliseconds(window),
});

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
  pending: Promise<unknown>;
}

interface KV {
  get(key: string): Promise<string | null>;
  put(
    key: string,
    value: string,
    options?: { expirationTtl?: number }
  ): Promise<void>;
}

const namespace = async (): Promise<KV | undefined> => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    return (env as { RATE_LIMIT?: KV }).RATE_LIMIT;
  } catch {
    return;
  }
};

export const createRateLimiter = (props: {
  limiter?: Limiter;
  prefix?: string;
  kv?: KV;
} = {}) => {
  const limiter = props.limiter ?? slidingWindow(10, "10 s");
  const prefix = props.prefix ?? "next-forge";

  return {
    limit: async (
      identifier: string,
      now: number = Date.now()
    ): Promise<RateLimitResult> => {
      const kv = props.kv ?? (await namespace());
      const { tokens, windowMs } = limiter;
      const current = Math.floor(now / windowMs);
      const reset = (current + 1) * windowMs;
      if (!kv) {
        // No namespace bound (a test, `next dev` without wrangler's proxy):
        // nothing to count against.
        return {
          success: true,
          limit: tokens,
          remaining: tokens,
          reset,
          pending: Promise.resolve(),
        };
      }
      const key = (window: number) => `${prefix}:${identifier}:${window}`;
      const [currentCount, previousCount] = await Promise.all([
        kv.get(key(current)).then(Number),
        kv.get(key(current - 1)).then(Number),
      ]);
      const elapsed = (now % windowMs) / windowMs;
      const used = Math.floor(previousCount * (1 - elapsed)) + currentCount;
      if (used >= tokens) {
        return {
          success: false,
          limit: tokens,
          remaining: 0,
          reset,
          pending: Promise.resolve(),
        };
      }
      // Kept two windows, and never under KV's 60-second minimum TTL.
      const ttl = Math.max(60, Math.ceil((2 * windowMs) / 1000));
      const pending = kv.put(key(current), String(currentCount + 1), {
        expirationTtl: ttl,
      });
      await pending;
      return {
        success: true,
        limit: tokens,
        remaining: Math.max(0, tokens - used - 1),
        reset,
        pending,
      };
    },
  };
};
