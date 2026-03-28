import net from "node:net";
import tls from "node:tls";
import type { WorkerEnv } from "@ecom/shared";

interface LoggerLike {
  info?(obj: unknown, msg?: string): void;
  warn?(obj: unknown, msg?: string): void;
  error?(obj: unknown, msg?: string): void;
}

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

interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  pass?: string;
  from: string;
}

function getFromAddress(env: WorkerEnv) {
  return env.APP_EMAIL_FROM;
}

function createResendProvider(env: WorkerEnv, logger: LoggerLike): EmailProvider {
  if (!env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is required for Resend provider");
  }

  const from = getFromAddress(env);

  return {
    async send(input: EmailSendInput): Promise<EmailSendResult> {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
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

function parseSmtpConfig(env: WorkerEnv): SmtpConfig {
  if (!env.SMTP_HOST) {
    throw new Error("SMTP_HOST is required when RESEND_API_KEY is not configured");
  }

  return {
    host: env.SMTP_HOST,
    port: env.SMTP_PORT ?? 587,
    secure: Boolean(env.SMTP_SECURE),
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
    from: getFromAddress(env)
  };
}

function parseReplyCode(line: string): number {
  const code = Number.parseInt(line.slice(0, 3), 10);
  return Number.isFinite(code) ? code : 0;
}

async function waitForReply(socket: net.Socket | tls.TLSSocket): Promise<string> {
  return new Promise((resolve, reject) => {
    const onData = (chunk: Buffer) => {
      cleanup();
      resolve(chunk.toString("utf8"));
    };

    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };

    const onTimeout = () => {
      cleanup();
      reject(new Error("SMTP timeout"));
    };

    const cleanup = () => {
      socket.off("data", onData);
      socket.off("error", onError);
      socket.off("timeout", onTimeout);
    };

    socket.once("data", onData);
    socket.once("error", onError);
    socket.once("timeout", onTimeout);
  });
}

async function writeLine(socket: net.Socket | tls.TLSSocket, line: string) {
  await new Promise<void>((resolve, reject) => {
    socket.write(`${line}\r\n`, (error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

async function expectReply(socket: net.Socket | tls.TLSSocket, expected: number[]) {
  const reply = await waitForReply(socket);
  const code = parseReplyCode(reply);
  if (!expected.includes(code)) {
    throw new Error(`SMTP unexpected reply: ${reply.trim()}`);
  }
}

function buildMimeMessage(from: string, input: EmailSendInput) {
  const messageId = `<${Date.now()}.${Math.random().toString(16).slice(2)}@local.smtp>`;
  const lines: string[] = [];

  lines.push(`From: ${from}`);
  lines.push(`To: ${input.to.join(", ")}`);
  if (input.cc?.length) {
    lines.push(`Cc: ${input.cc.join(", ")}`);
  }
  lines.push(`Subject: ${input.subject}`);
  lines.push(`Message-ID: ${messageId}`);
  lines.push("MIME-Version: 1.0");
  lines.push('Content-Type: multipart/alternative; boundary="ecom-boundary"');
  lines.push("");
  lines.push("--ecom-boundary");
  lines.push("Content-Type: text/plain; charset=utf-8");
  lines.push("");
  lines.push(input.text ?? "");
  lines.push("");
  lines.push("--ecom-boundary");
  lines.push("Content-Type: text/html; charset=utf-8");
  lines.push("");
  lines.push(input.html);
  lines.push("");
  lines.push("--ecom-boundary--");
  lines.push("");

  return {
    messageId,
    raw: lines.join("\r\n")
  };
}

async function sendSmtp(config: SmtpConfig, input: EmailSendInput, logger: LoggerLike): Promise<EmailSendResult> {
  const socket = config.secure
    ? tls.connect({ host: config.host, port: config.port })
    : net.connect({ host: config.host, port: config.port });

  socket.setTimeout(15000);

  try {
    await expectReply(socket, [220]);

    await writeLine(socket, "EHLO localhost");
    await expectReply(socket, [250]);

    if (config.user && config.pass) {
      await writeLine(socket, "AUTH LOGIN");
      await expectReply(socket, [334]);
      await writeLine(socket, Buffer.from(config.user, "utf8").toString("base64"));
      await expectReply(socket, [334]);
      await writeLine(socket, Buffer.from(config.pass, "utf8").toString("base64"));
      await expectReply(socket, [235]);
    }

    await writeLine(socket, `MAIL FROM:<${config.from}>`);
    await expectReply(socket, [250]);

    const recipients = [...input.to, ...(input.cc ?? []), ...(input.bcc ?? [])];
    for (const recipient of recipients) {
      await writeLine(socket, `RCPT TO:<${recipient}>`);
      await expectReply(socket, [250, 251]);
    }

    await writeLine(socket, "DATA");
    await expectReply(socket, [354]);

    const mime = buildMimeMessage(config.from, input);
    await writeLine(socket, mime.raw);
    await writeLine(socket, ".");
    await expectReply(socket, [250]);

    await writeLine(socket, "QUIT");

    return { messageId: mime.messageId };
  } catch (error) {
    logger.error?.({ err: error }, "smtp send failed");
    throw error;
  } finally {
    socket.end();
  }
}

function createSmtpProvider(env: WorkerEnv, logger: LoggerLike): EmailProvider {
  const config = parseSmtpConfig(env);

  return {
    async send(input: EmailSendInput): Promise<EmailSendResult> {
      return sendSmtp(config, input, logger);
    }
  };
}

export function createEmailProvider(env: WorkerEnv, logger: LoggerLike): EmailProvider {
  if (env.RESEND_API_KEY) {
    return createResendProvider(env, logger);
  }

  return createSmtpProvider(env, logger);
}
