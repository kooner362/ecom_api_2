import type { EmailProvider, EmailProviderEnv, EmailSendInput, EmailSendResult } from "./emailProvider.js";

interface LoggerLike {
  error?(obj: unknown, msg?: string): void;
}

function requireFromAddress(env: EmailProviderEnv): string {
  if (!env.APP_EMAIL_FROM) {
    throw new Error("APP_EMAIL_FROM is required for email sending");
  }

  return env.APP_EMAIL_FROM;
}

export function createResendProvider(env: EmailProviderEnv, logger: LoggerLike): EmailProvider {
  const apiKey = env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is required for Resend provider");
  }

  const from = requireFromAddress(env);

  return {
    async send(input: EmailSendInput): Promise<EmailSendResult> {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          from,
          to: input.to,
          cc: input.cc,
          bcc: input.bcc,
          subject: input.subject,
          html: input.html,
          text: input.text
        })
      });

      if (!response.ok) {
        const body = await response.text();
        logger.error?.({ status: response.status, body }, "resend send failed");
        throw new Error(`Resend send failed: ${response.status}`);
      }

      const body = (await response.json()) as { id?: string };
      return {
        messageId: body.id ?? `resend-${Date.now()}`
      };
    }
  };
}
