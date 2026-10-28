import "server-only";

import {
  auth as clerkAuth,
  currentUser as clerkCurrentUser,
} from "@clerk/nextjs/server";
import { isClerkConfigured } from "./connected";
import { sampleAuth, sampleUser } from "./sample";

export * from "@clerk/nextjs/server";

// Clerk's `auth()` and `currentUser()`, or the sample identity while Clerk is
// not connected (./connected.ts). Every caller in the apps is unchanged.
export const auth = (async (...args: Parameters<typeof clerkAuth>) => {
  if (isClerkConfigured()) {
    return clerkAuth(...args);
  }
  return sampleAuth;
}) as unknown as typeof clerkAuth;

export const currentUser = (async () => {
  if (isClerkConfigured()) {
    return clerkCurrentUser();
  }
  return sampleUser;
}) as unknown as typeof clerkCurrentUser;

export { isClerkConfigured } from "./connected";
