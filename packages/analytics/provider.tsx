import { GoogleAnalytics } from "@next/third-parties/google";
import type { ReactNode } from "react";
import { keys } from "./keys";

interface AnalyticsProviderProps {
  readonly children: ReactNode;
}

const { NEXT_PUBLIC_GA_MEASUREMENT_ID } = keys();

// Vercel Analytics is Vercel's own; on Cloudflare, Web Analytics is a
// dashboard switch on a custom domain. PostHog and Google Analytics stay.
export const AnalyticsProvider = ({ children }: AnalyticsProviderProps) => (
  <>
    {children}
    {NEXT_PUBLIC_GA_MEASUREMENT_ID && (
      <GoogleAnalytics gaId={NEXT_PUBLIC_GA_MEASUREMENT_ID} />
    )}
  </>
);
