import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// next-forge requires Clerk; a product built from the baseline goes live
// before its owner has a Clerk application. @repo/auth decides once whether
// Clerk is connected (both keys set) and, when it is not, gives the apps a
// sample identity, runs the proxy's callback without Clerk's middleware and
// says on the sign-in and sign-up pages what to set. No network.

const KEYS = ["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "CLERK_SECRET_KEY"] as const;

describe("@repo/auth with no Clerk application", () => {
  beforeEach(() => {
    vi.resetModules();
    for (const key of KEYS) {
      delete process.env[key];
    }
  });

  it("reports Clerk unconfigured unless both keys are set", async () => {
    const { isClerkConfigured } = await import("@repo/auth/connected");
    expect(isClerkConfigured()).toBe(false);
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = "pk_test_x";
    expect(isClerkConfigured()).toBe(false);
    process.env.CLERK_SECRET_KEY = "sk_test_x";
    expect(isClerkConfigured()).toBe(true);
  });

  it("hands the apps the sample user and organization", async () => {
    const { auth, currentUser } = await import("@repo/auth/server");
    const session = await auth();
    expect(session.userId).toBe("user_sample");
    expect(session.orgId).toBe("org_sample");
    const user = await currentUser();
    expect(user?.id).toBe("user_sample");
    expect(user?.fullName).toBe("Sample User");
  });

  it("runs the proxy's own callback, with the sample identity, without Clerk", async () => {
    const { NextRequest, NextResponse } = await import("next/server");
    const { authMiddleware } = await import("@repo/auth/proxy");
    const seen: string[] = [];
    const proxy = authMiddleware(async (getAuth, request) => {
      const session = await getAuth();
      seen.push(`${session.userId} ${new URL(request.url).pathname}`);
      return NextResponse.next({ headers: { "x-proxied": "yes" } });
    });
    const response = (await proxy(
      new NextRequest("https://app.example.com/search"),
      {} as never
    )) as Response;
    expect(seen).toEqual(["user_sample /search"]);
    expect(response.headers.get("x-proxied")).toBe("yes");
  });

  it("says what to connect on the sign-in and sign-up pages", async () => {
    const { SignIn } = await import("@repo/auth/components/sign-in");
    const { SignUp } = await import("@repo/auth/components/sign-up");
    for (const Component of [SignIn, SignUp]) {
      const html = renderToString(<Component />);
      expect(html).toContain('data-auth="not-connected"');
      expect(html).toContain("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY");
      expect(html).toContain("CLERK_SECRET_KEY");
    }
  });

  it("renders the sidebar's widgets as labels, not Clerk's components", async () => {
    const { OrganizationSwitcher, UserButton } = await import("@repo/auth/client");
    expect(renderToString(<OrganizationSwitcher />)).toContain("Sample organization");
    expect(renderToString(<UserButton />)).toContain('data-sample="user"');
  });
});
