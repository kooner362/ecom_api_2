import net from "node:net";
import tls from "node:tls";
import type { EmailProvider, EmailProviderEnv, EmailSendInput, EmailSendResult } from "./emailProvider.js";

interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  pass?: string;
  from: string;
}

interface LoggerLike {
  error?(obj: unknown, msg?: string): void;
}

function parseConfig(env: EmailProviderEnv): SmtpConfig {
  if (!env.SMTP_HOST) {
    throw new Error("SMTP_HOST is required when RESEND_API_KEY is not configured");
  }

  if (!env.APP_EMAIL_FROM) {
    throw new Error("APP_EMAIL_FROM is required for SMTP provider");
  }

  return {
    host: env.SMTP_HOST,
    port: env.SMTP_PORT ?? 587,
    secure: Boolean(env.SMTP_SECURE),
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
    from: env.APP_EMAIL_FROM
  };
}

function buildMimeMessage(from: string, input: EmailSendInput) {
  const lines: string[] = [];
  const messageId = `<${Date.now()}.${Math.random().toString(16).slice(2)}@local.smtp>`;

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
    data: lines.join("\r\n"),
    messageId
  };
}

function parseReplyCode(line: string): number {
  const code = Number.parseInt(line.slice(0, 3), 10);
  return Number.isFinite(code) ? code : 0;
}

async function waitForReply(socket: net.Socket | tls.TLSSocket): Promise<string> {
  return new Promise((resolve, reject) => {
    const onData = (chunk: Buffer) => {
      const message = chunk.toString("utf8");
      cleanup();
      resolve(message);
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

async function expectReply(socket: net.Socket | tls.TLSSocket, expectedCodes: number[]) {
  const reply = await waitForReply(socket);
  const replyCode = parseReplyCode(reply);
  if (!expectedCodes.includes(replyCode)) {
    throw new Error(`SMTP unexpected reply: ${reply.trim()}`);
  }
}

async function sendSmtpMessage(config: SmtpConfig, input: EmailSendInput, logger: LoggerLike): Promise<EmailSendResult> {
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

    const message = buildMimeMessage(config.from, input);
    await writeLine(socket, message.data);
    await writeLine(socket, ".");
    await expectReply(socket, [250]);

    await writeLine(socket, "QUIT");

    return { messageId: message.messageId };
  } catch (error) {
    logger.error?.({ err: error }, "smtp send failed");
    throw error;
  } finally {
    socket.end();
  }
}

export function createSmtpProvider(env: EmailProviderEnv, logger: LoggerLike): EmailProvider {
  const config = parseConfig(env);

  return {
    async send(input: EmailSendInput): Promise<EmailSendResult> {
      return sendSmtpMessage(config, input, logger);
    }
  };
}
