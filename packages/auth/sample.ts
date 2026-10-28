// The sample identity the apps run as while Clerk is not connected
// (./connected.ts). One user in one organization, the same on every request:
// enough for the dashboard, the database page and the sidebar to render, and
// obviously not a real account. Nothing here is a credential.
import { redirect } from "next/navigation";

export const SAMPLE_USER_ID = "user_sample";
export const SAMPLE_ORG_ID = "org_sample";

export const sampleUser = {
  id: SAMPLE_USER_ID,
  firstName: "Sample",
  lastName: "User",
  fullName: "Sample User",
  username: "sample",
  imageUrl: "",
  hasImage: false,
  primaryEmailAddressId: "idn_sample",
  emailAddresses: [{ id: "idn_sample", emailAddress: "sample@example.com" }],
  publicMetadata: {},
  privateMetadata: {},
  unsafeMetadata: {},
};

export const sampleAuth = {
  userId: SAMPLE_USER_ID,
  orgId: SAMPLE_ORG_ID,
  orgRole: "org:admin",
  orgSlug: "sample",
  sessionId: "sess_sample",
  sessionClaims: null,
  actor: null,
  isAuthenticated: true,
  tokenType: "session_token",
  getToken: async () => null,
  has: () => true,
  debug: () => ({}),
  redirectToSignIn: (): never => redirect("/sign-in"),
  redirectToSignUp: (): never => redirect("/sign-up"),
};
