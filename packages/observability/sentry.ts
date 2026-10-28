// Errors to a Sentry project over Sentry's envelope endpoint, with `fetch`.
//
// Upstream wires `@sentry/nextjs`, which instruments Node and the Edge runtime
// at build time and is several hundred kilobytes in every Worker. A Worker's
// logs are Workers Logs already (wrangler.jsonc `observability`), so what is
// left for Sentry is the exception itself: this posts one event per error,
// best effort, when NEXT_PUBLIC_SENTRY_DSN is set, and does nothing when it
// is not. The same code runs on the server and in the browser.

interface Dsn {
  key: string;
  url: string;
}

export const parseDsn = (dsn: string | undefined): Dsn | undefined => {
  if (!dsn) {
    return;
  }
  try {
    const { protocol, username, host, pathname } = new URL(dsn);
    const project = pathname.replace(/^\//, "");
    if (!(username && project)) {
      return;
    }
    return {
      key: username,
      url: `${protocol}//${host}/api/${project}/envelope/`,
    };
  } catch {
    return;
  }
};

const frames = (stack: string | undefined) =>
  (stack ?? "")
    .split("\n")
    .slice(1)
    .map((line) => ({ function: line.trim() }))
    .reverse();

export const envelopeFor = (error: unknown, dsn: Dsn, extra?: object) => {
  const err = error instanceof Error ? error : new Error(String(error));
  const eventId = crypto.randomUUID().replace(/-/g, "");
  const event = {
    event_id: eventId,
    timestamp: Date.now() / 1000,
    platform: "javascript",
    level: "error",
    exception: {
      values: [
        {
          type: err.name,
          value: err.message,
          stacktrace: { frames: frames(err.stack) },
        },
      ],
    },
    extra,
  };
  const header = { event_id: eventId, sent_at: new Date().toISOString(), dsn: dsn.url };
  return [
    JSON.stringify(header),
    JSON.stringify({ type: "event" }),
    JSON.stringify(event),
  ].join("\n");
};

export const captureException = (error: unknown, extra?: object) => {
  const dsn = parseDsn(process.env.NEXT_PUBLIC_SENTRY_DSN);
  if (!dsn) {
    return;
  }
  // Best effort: a report that cannot be delivered is not the request's
  // failure.
  fetch(dsn.url, {
    method: "POST",
    keepalive: true,
    headers: {
      "content-type": "application/x-sentry-envelope",
      "x-sentry-auth": `Sentry sentry_version=7, sentry_key=${dsn.key}, sentry_client=next-forge-workers/1.0`,
    },
    body: envelopeFor(error, dsn, extra),
  }).catch(() => undefined);
};
