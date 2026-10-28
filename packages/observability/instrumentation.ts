import { captureException } from "./sentry";

// Nothing to initialize: there is no SDK (./sentry.ts).
export const initializeSentry = () => undefined;

// Next calls this for every error a request throws on the server.
export const onRequestError = (
  error: unknown,
  request: { path: string; method: string }
) => {
  console.error(error);
  captureException(error, { path: request.path, method: request.method });
};
