import { createResendProvider } from "./resendProvider.js";
import { createSmtpProvider } from "./smtpProvider.js";

export interface EmailSendInput {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  html: string;
  text?: string;
}

export interface EmailSendResult {
  messageId: string;
}

export interface EmailProvider {
  send(input: EmailSendInput): Promise<EmailSendResult>;
}

export interface EmailProviderEnv {
  APP_EMAIL_FROM?: string;
  RESEND_API_KEY?: string;
  SMTP_HOST?: string;
  SMTP_PORT?: number;
  SMTP_SECURE?: boolean;
  SMTP_USER?: string;
  SMTP_PASS?: string;
}

interface LoggerLike {
  info?(obj: unknown, msg?: string): void;
  warn?(obj: unknown, msg?: string): void;
  error?(obj: unknown, msg?: string): void;
}

export function createEmailProvider(env: EmailProviderEnv, logger: LoggerLike): EmailProvider {
  if (env.RESEND_API_KEY) {
    return createResendProvider(env, logger);
  }

  return createSmtpProvider(env, logger);
}
