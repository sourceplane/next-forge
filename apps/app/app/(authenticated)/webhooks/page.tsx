import { isWebhooksConfigured, webhooks } from "@repo/webhooks";
import { notFound } from "next/navigation";

export const metadata = {
  title: "Webhooks",
  description: "Send webhooks to your users.",
};

const WebhooksPage = async () => {
  if (!isWebhooksConfigured()) {
    return (
      <div
        className="m-4 rounded-lg border border-dashed p-4 text-muted-foreground text-sm"
        data-webhooks="not-connected"
        role="status"
      >
        Webhooks are not connected: store a Svix API key as this
        product&apos;s <code>SVIX_TOKEN</code> secret to give your users a
        webhooks portal here.
      </div>
    );
  }

  const response = await webhooks.getAppPortal();

  if (!response?.url) {
    notFound();
  }

  return (
    <div className="h-full w-full overflow-hidden">
      <iframe
        allow="clipboard-write"
        className="h-full w-full border-none"
        loading="lazy"
        src={response.url}
        title="Webhooks"
      />
    </div>
  );
};

export default WebhooksPage;
