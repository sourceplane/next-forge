"use server";

import { resend } from "@repo/email";
import { ContactTemplate } from "@repo/email/templates/contact";
import { parseError } from "@repo/observability/error";
import { createRateLimiter, slidingWindow } from "@repo/rate-limit";
import { headers } from "next/headers";
import { env } from "@/env";

export const contact = async (
  name: string,
  email: string,
  message: string
): Promise<{
  error?: string;
}> => {
  try {
    // Upstream rate-limits only when Upstash is configured; the Workers KV
    // namespace it runs on here is always bound (@repo/rate-limit). The
    // visitor's address is Cloudflare's header for it.
    const rateLimiter = createRateLimiter({
      limiter: slidingWindow(1, "1d"),
    });
    const head = await headers();
    const ip = head.get("cf-connecting-ip") ?? head.get("x-forwarded-for");

    const { success } = await rateLimiter.limit(`contact_form_${ip}`);

    if (!success) {
      throw new Error(
        "You have reached your request limit. Please try again later."
      );
    }

    if (!(resend && env.RESEND_FROM)) {
      throw new Error("Email is not configured.");
    }

    await resend.emails.send({
      from: env.RESEND_FROM,
      to: env.RESEND_FROM,
      subject: "Contact form submission",
      replyTo: email,
      react: <ContactTemplate email={email} message={message} name={name} />,
    });

    return {};
  } catch (error) {
    const errorMessage = parseError(error);

    return { error: errorMessage };
  }
};
