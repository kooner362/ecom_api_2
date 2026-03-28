import { prisma } from "@ecom/db";
import type { SendEmailEventPayload } from "@ecom/shared";
import type { WorkerEnv } from "@ecom/shared";
import { createEmailProvider } from "../email/provider.js";
import crypto from "node:crypto";

const db = prisma as any;

interface LoggerLike {
  info?(obj: unknown, msg?: string): void;
  warn?(obj: unknown, msg?: string): void;
  error?(obj: unknown, msg?: string): void;
}

const ROOT_ALLOWED_PATHS = new Set([
  "order.orderNumber",
  "order.totalCents",
  "order.subtotalCents",
  "order.discountCents",
  "order.taxCents",
  "order.shippingCents",
  "order.trackingNumber",
  "customer.email",
  "customer.name",
  "shipping.methodType",
  "shippingAddress.name",
  "shippingAddress.line1",
  "shippingAddress.line2",
  "shippingAddress.city",
  "shippingAddress.province",
  "shippingAddress.country",
  "shippingAddress.postalCode",
  "shippingAddress.phone",
  "payment.method",
  "payment.etransferEmail",
  "payment.instructions"
]);

const ITEM_ALLOWED_PATHS = new Set(["title", "sku", "quantity", "unitPriceCents", "lineSubtotalCents"]);

function dedupeEmails(emails: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();

  for (const raw of emails) {
    const normalized = raw.trim().toLowerCase();
    if (!normalized || seen.has(normalized)) {
      continue;
    }

    out.push(normalized);
    seen.add(normalized);
  }

  return out;
}

function readPath(obj: unknown, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = obj;

  for (const part of parts) {
    if (!current || typeof current !== "object" || !(part in (current as Record<string, unknown>))) {
      return undefined;
    }

    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

function stringifyValue(value: unknown, path?: string): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number") {
    if (path?.endsWith("Cents")) {
      return `$${(value / 100).toFixed(2)}`;
    }
    return `${value}`;
  }

  if (typeof value === "boolean") {
    return `${value}`;
  }

  return "";
}

function renderItems(template: string, items: Array<Record<string, unknown>>): string {
  return template.replace(/{{#items}}([\s\S]*?){{\/items}}/g, (_m, block: string) => {
    return items
      .map((item) => {
        return block.replace(/{{\s*([a-zA-Z0-9_.]+)\s*}}/g, (_b, path: string) => {
          if (!ITEM_ALLOWED_PATHS.has(path)) {
            return "";
          }

          return stringifyValue(readPath(item, path), path);
        });
      })
      .join("");
  });
}

function renderVariables(template: string, context: Record<string, unknown>): string {
  return template.replace(/{{\s*([a-zA-Z0-9_.]+)\s*}}/g, (_m, path: string) => {
    if (!ROOT_ALLOWED_PATHS.has(path)) {
      return "";
    }

    return stringifyValue(readPath(context, path), path);
  });
}

function renderTemplate(template: string, context: Record<string, unknown>): string {
  const items = Array.isArray(context.items) ? (context.items as Array<Record<string, unknown>>) : [];
  return renderVariables(renderItems(template, items), context);
}

function decryptJson<T>(payload: unknown, keyMaterial: string): T {
  if (!payload || typeof payload !== "object") {
    throw new Error("Invalid encrypted payload");
  }
  const typed = payload as { iv?: string; tag?: string; data?: string };
  if (!typed.iv || !typed.tag || !typed.data) {
    throw new Error("Invalid encrypted payload");
  }
  const key = crypto.createHash("sha256").update(keyMaterial, "utf8").digest();
  const iv = Buffer.from(typed.iv, "base64");
  const tag = Buffer.from(typed.tag, "base64");
  const encrypted = Buffer.from(typed.data, "base64");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return JSON.parse(decrypted.toString("utf8")) as T;
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "P2002";
}

async function upsertQueuedLog(payload: SendEmailEventPayload) {
  return db.emailLog.upsert({
    where: {
      storeId_idempotencyKey: {
        storeId: payload.storeId,
        idempotencyKey: payload.idempotencyKey
      }
    },
    create: {
      storeId: payload.storeId,
      orderId: payload.orderId,
      routeType: payload.routeType,
      status: "QUEUED",
      to: { to: [], cc: [], bcc: [] },
      idempotencyKey: payload.idempotencyKey
    },
    update: {
      updatedAt: new Date()
    }
  });
}

async function markFailed(logId: string, message: string) {
  await db.emailLog.update({
    where: { id: logId },
    data: {
      status: "FAILED",
      errorMessage: message
    }
  });
}

export async function processSendEmailEvent(payload: SendEmailEventPayload, env: WorkerEnv, logger: LoggerLike) {
  const log = await upsertQueuedLog(payload);

  if (log.status === "SENT" && !payload.force) {
    logger.info?.({ orderId: payload.orderId, routeType: payload.routeType }, "email already sent, skipping");
    return;
  }

  const order = await db.order.findFirst({
    where: {
      id: payload.orderId,
      storeId: payload.storeId
    },
    include: {
      customer: {
        select: {
          name: true,
          email: true
        }
      },
      shippingAddress: true,
      items: {
        orderBy: [{ id: "asc" }]
      }
    }
  });

  if (!order) {
    await markFailed(log.id, "Order not found");
    return;
  }

  const route = await db.emailRoute.findUnique({
    where: {
      storeId_type: {
        storeId: payload.storeId,
        type: payload.routeType
      }
    },
    include: {
      recipients: true,
      template: true
    }
  });

  if (!route) {
    await markFailed(log.id, "Email route not found");
    return;
  }

  if (!route.enabled && !payload.force) {
    await markFailed(log.id, "Email route disabled");
    return;
  }

  if (!route.template) {
    await markFailed(log.id, "Email template missing");
    return;
  }

  const configuredTo = dedupeEmails(
    route.recipients.filter((item: any) => item.kind === "TO").map((item: any) => item.email)
  );
  const configuredCc = dedupeEmails(
    route.recipients.filter((item: any) => item.kind === "CC").map((item: any) => item.email)
  );
  const configuredBcc = dedupeEmails(
    route.recipients.filter((item: any) => item.kind === "BCC").map((item: any) => item.email)
  );

  const resolvedRecipients =
    payload.routeType === "CUSTOMER_CONFIRMATION" ||
    payload.routeType === "SHIPPED_CONFIRMATION" ||
    payload.routeType === "DELIVERED_CONFIRMATION"
      ? {
          to: dedupeEmails([order.email]),
          cc: configuredCc,
          bcc: configuredBcc
        }
      : {
          to: configuredTo,
          cc: configuredCc,
          bcc: configuredBcc
        };

  if (resolvedRecipients.to.length === 0) {
    await markFailed(log.id, "No recipients configured");
    return;
  }

  const successfulPayment = await db.payment.findFirst({
    where: {
      storeId: payload.storeId,
      orderId: payload.orderId,
      status: "SUCCEEDED"
    },
    orderBy: [{ createdAt: "desc" }]
  });

  let manualPaymentEmail = "";
  const orderPlacedEvent = await db.orderEvent.findFirst({
    where: {
      storeId: payload.storeId,
      orderId: payload.orderId,
      type: "ORDER_PLACED"
    },
    orderBy: [{ createdAt: "desc" }],
    select: {
      metadata: true
    }
  });
  const eventManualPaymentEmail = (() => {
    const metadata = orderPlacedEvent?.metadata;
    if (!metadata || typeof metadata !== "object") return "";
    const value = (metadata as Record<string, unknown>).manualPaymentEmail;
    return typeof value === "string" ? value.trim() : "";
  })();

  if (eventManualPaymentEmail) {
    manualPaymentEmail = eventManualPaymentEmail;
  }

  if (successfulPayment?.provider === "OTHER") {
    const manualSetting = await db.paymentProviderSetting.findUnique({
      where: {
        storeId_provider: {
          storeId: payload.storeId,
          provider: "OTHER"
        }
      }
    });

    if (manualSetting?.configEncrypted && env.APP_ENCRYPTION_KEY) {
      try {
        const config = decryptJson<{ manualPaymentEmail?: string }>(manualSetting.configEncrypted, env.APP_ENCRYPTION_KEY);
        if (!manualPaymentEmail) {
          manualPaymentEmail = (config.manualPaymentEmail || "").trim();
        }
      } catch {
        if (!manualPaymentEmail) {
          manualPaymentEmail = "";
        }
      }
    }
  }

  const context = {
    order: {
      orderNumber: order.orderNumber,
      totalCents: order.totalCents,
      subtotalCents: order.subtotalCents,
      discountCents: order.discountCents,
      taxCents: order.taxCents,
      shippingCents: order.shippingCents,
      trackingNumber: order.trackingNumber ?? ""
    },
    customer: {
      email: order.email,
      name: order.customer?.name ?? ""
    },
    shipping: {
      methodType: order.shippingMethodType
    },
    shippingAddress: order.shippingAddress
      ? {
          name: order.shippingAddress.name,
          line1: order.shippingAddress.line1,
          line2: order.shippingAddress.line2 ?? "",
          city: order.shippingAddress.city,
          province: order.shippingAddress.province,
          country: order.shippingAddress.country,
          postalCode: order.shippingAddress.postalCode,
          phone: order.shippingAddress.phone ?? ""
        }
      : {
          name: "",
          line1: "",
          line2: "",
          city: "",
          province: "",
          country: "",
          postalCode: "",
          phone: ""
        },
    payment: {
      method: successfulPayment?.provider || "",
      etransferEmail: manualPaymentEmail,
      instructions:
        successfulPayment?.provider === "OTHER" && manualPaymentEmail
          ? `Please send your e-transfer to ${manualPaymentEmail}. Include order number ${order.orderNumber} in the memo.`
          : ""
    },
    items: order.items.map((item: any) => ({
      title: item.titleSnapshot,
      sku: item.skuSnapshot ?? "",
      quantity: item.quantity,
      unitPriceCents: item.unitPriceCents,
      lineSubtotalCents: item.lineSubtotalCents
    }))
  };

  const subject = renderTemplate(route.template.subject, context);
  let html = renderTemplate(route.template.html, context);
  let text = route.template.text ? renderTemplate(route.template.text, context) : undefined;

  const manualInstructions = (context.payment as { instructions?: string } | undefined)?.instructions || "";
  if (payload.routeType === "CUSTOMER_CONFIRMATION" && manualInstructions.trim()) {
    if (!html.includes(manualInstructions)) {
      html = `${html}\n<p>${manualInstructions}</p>`;
    }
    if (text !== undefined && !text.includes(manualInstructions)) {
      text = `${text}\n${manualInstructions}`.trim();
    }
  }

  try {
    const provider = createEmailProvider(env, logger);
    const result = await provider.send({
      to: resolvedRecipients.to,
      cc: resolvedRecipients.cc,
      bcc: resolvedRecipients.bcc,
      subject,
      html,
      text
    });

    await db.emailLog.update({
      where: { id: log.id },
      data: {
        status: "SENT",
        providerMessageId: result.messageId,
        errorMessage: null,
        to: resolvedRecipients
      }
    });

    logger.info?.(
      {
        orderId: payload.orderId,
        routeType: payload.routeType,
        messageId: result.messageId
      },
      "email sent"
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Email send failed";
    await db.emailLog.update({
      where: { id: log.id },
      data: {
        status: "FAILED",
        errorMessage: message,
        to: resolvedRecipients
      }
    });

    logger.error?.({ err: error, orderId: payload.orderId, routeType: payload.routeType }, "email send failed");
    throw error;
  }
}

export { isUniqueViolation };
