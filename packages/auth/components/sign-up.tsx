import { SignUp as ClerkSignUp } from "@clerk/nextjs";
import { isClerkConfiguredInBrowser } from "../connected";
import { ConnectClerk } from "./not-connected";

export const SignUp = () =>
  isClerkConfiguredInBrowser() ? (
    <ClerkSignUp
      appearance={{
        elements: {
          header: "hidden",
        },
      }}
    />
  ) : (
    <ConnectClerk />
  );
