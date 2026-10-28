import { SignIn as ClerkSignIn } from "@clerk/nextjs";
import { isClerkConfiguredInBrowser } from "../connected";
import { ConnectClerk } from "./not-connected";

export const SignIn = () =>
  isClerkConfiguredInBrowser() ? (
    <ClerkSignIn
      appearance={{
        elements: {
          header: "hidden",
        },
      }}
    />
  ) : (
    <ConnectClerk />
  );
