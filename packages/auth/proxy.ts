import { clerkMiddleware } from "@clerk/nextjs/server";
import { type NextFetchEvent, type NextRequest, NextResponse } from "next/server";
import { isClerkConfigured } from "./connected";
import { sampleAuth } from "./sample";

type Handler = (
  auth: () => Promise<typeof sampleAuth>,
  request: NextRequest,
  event: NextFetchEvent
) => unknown;

// Clerk's middleware, or — while Clerk is not connected (./connected.ts) —
// the same callback run with the sample identity, so the proxy's other work
// (security headers, locale routing, Arcjet) still runs. Decided per request:
// a Worker's secrets are in its environment from its first request on.
export const authMiddleware = ((handler?: Handler) => {
  const withClerk = clerkMiddleware(handler as never);

  return (request: NextRequest, event: NextFetchEvent) => {
    if (isClerkConfigured()) {
      return withClerk(request, event);
    }
    if (!handler) {
      return NextResponse.next();
    }
    return handler(async () => sampleAuth, request, event);
  };
}) as unknown as typeof clerkMiddleware;
