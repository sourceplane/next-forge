import {
  OrganizationSwitcher as ClerkOrganizationSwitcher,
  UserButton as ClerkUserButton,
} from "@clerk/nextjs";
import { createElement } from "react";
import { isClerkConfiguredInBrowser } from "./connected";

export * from "@clerk/nextjs";

// The sidebar's two Clerk widgets, or a plain label while Clerk is not
// connected (./connected.ts): Clerk's components throw outside a
// ClerkProvider, and there is none without a publishable key.
export const OrganizationSwitcher = ((props: object) =>
  isClerkConfiguredInBrowser()
    ? createElement(ClerkOrganizationSwitcher, props)
    : createElement(
        "span",
        { className: "truncate px-2 font-medium text-sm", "data-sample": "organization" },
        "Sample organization"
      )) as unknown as typeof ClerkOrganizationSwitcher;

export const UserButton = ((props: object) =>
  isClerkConfiguredInBrowser()
    ? createElement(ClerkUserButton, props)
    : createElement(
        "span",
        {
          className:
            "flex size-7 items-center justify-center rounded-full bg-muted font-medium text-xs",
          "data-sample": "user",
          title: "Sample User",
        },
        "SU"
      )) as unknown as typeof ClerkUserButton;
