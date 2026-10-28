import type { ReactNode } from "react";

// What the sign-in and sign-up pages show while Clerk is not connected
// (../connected.ts), and the notice above the dashboard.
const Notice = ({ children }: { readonly children: ReactNode }) => (
  <div
    className="rounded-lg border border-dashed p-4 text-muted-foreground text-sm"
    data-auth="not-connected"
    role="status"
  >
    {children}
  </div>
);

export const ConnectClerk = () => (
  <Notice>
    <p className="font-medium text-foreground">Sign-in is not connected yet.</p>
    <p className="mt-2">
      Store your Clerk application&apos;s keys as this product&apos;s secrets —{" "}
      <code>NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY</code> and{" "}
      <code>CLERK_SECRET_KEY</code> — and redeploy. Until then the dashboard
      opens as a sample user.
    </p>
    <p className="mt-2">
      <a className="underline" href="/">
        Open the dashboard
      </a>
    </p>
  </Notice>
);

export const SampleUserNotice = () => (
  <Notice>
    You are viewing the dashboard as a sample user: sign-in is not connected.
    Store <code>NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY</code> and{" "}
    <code>CLERK_SECRET_KEY</code> to require it.
  </Notice>
);
