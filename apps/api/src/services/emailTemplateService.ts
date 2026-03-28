import { prisma } from "@ecom/db";
import { badRequest } from "../lib/errors.js";
import { decryptJson } from "../lib/crypto.js";

const db = prisma as any;

export const EMAIL_ROUTE_TYPES = [
  "CUSTOMER_CONFIRMATION",
  "PACKING",
  "WAREHOUSE",
  "SHIPPED_CONFIRMATION",
  "DELIVERED_CONFIRMATION"
] as const;
export type EmailRouteType = (typeof EMAIL_ROUTE_TYPES)[number];
export type EmailRecipientKind = "TO" | "CC" | "BCC";

const ROUTE_TEMPLATE_DEFAULTS: Record<EmailRouteType, { subject: string; html: string; text: string }> = {
  CUSTOMER_CONFIRMATION: {
    subject: "Order {{order.orderNumber}} confirmation",
    html: `<h1>Thanks for your order {{customer.name}}</h1>
<p>Order number: {{order.orderNumber}}</p>
<ul>
{{#items}}<li>{{title}} x {{quantity}} = {{lineSubtotalCents}}</li>{{/items}}
</ul>
<p>Subtotal: {{order.subtotalCents}}</p>
<p>Discount: {{order.discountCents}}</p>
<p>Tax: {{order.taxCents}}</p>
<p>Shipping: {{order.shippingCents}}</p>
<p><strong>Total: {{order.totalCents}}</strong></p>
<p>{{payment.instructions}}</p>`,
    text: `Order {{order.orderNumber}} confirmed.
Subtotal: {{order.subtotalCents}}
Discount: {{order.discountCents}}
Tax: {{order.taxCents}}
Shipping: {{order.shippingCents}}
Total: {{order.totalCents}}.
{{payment.instructions}}`
  },
  PACKING: {
    subject: "Packing slip for order {{order.orderNumber}}",
    html: `<h1>Packing required for order {{order.orderNumber}}</h1>
<p>Customer: {{customer.name}}</p>
<p>Ship to:</p>
<p>
  {{shippingAddress.name}}<br/>
  {{shippingAddress.line1}}<br/>
  {{shippingAddress.line2}}<br/>
  {{shippingAddress.city}}, {{shippingAddress.province}} {{shippingAddress.postalCode}}<br/>
  {{shippingAddress.country}}
</p>
<p>Shipping method: {{shipping.methodType}}</p>
<ul>
{{#items}}<li>{{title}} ({{sku}}) x {{quantity}}</li>{{/items}}
</ul>`,
    text: `Pack order {{order.orderNumber}} for {{customer.name}}. Ship to {{shippingAddress.name}}, {{shippingAddress.line1}}, {{shippingAddress.line2}}, {{shippingAddress.city}}, {{shippingAddress.province}}, {{shippingAddress.postalCode}}, {{shippingAddress.country}}.`
  },
  WAREHOUSE: {
    subject: "Warehouse notice for order {{order.orderNumber}}",
    html: `<h1>Warehouse action for order {{order.orderNumber}}</h1>
<p>Customer: {{customer.name}}</p>
<p>Ship to:</p>
<p>
  {{shippingAddress.name}}<br/>
  {{shippingAddress.line1}}<br/>
  {{shippingAddress.line2}}<br/>
  {{shippingAddress.city}}, {{shippingAddress.province}} {{shippingAddress.postalCode}}<br/>
  {{shippingAddress.country}}
</p>
<p>Total: {{order.totalCents}}</p>
<ul>
{{#items}}<li>{{title}} x {{quantity}}</li>{{/items}}
</ul>`,
    text: `Warehouse notification for order {{order.orderNumber}} for {{customer.name}}. Ship to {{shippingAddress.name}}, {{shippingAddress.line1}}, {{shippingAddress.line2}}, {{shippingAddress.city}}, {{shippingAddress.province}}, {{shippingAddress.postalCode}}, {{shippingAddress.country}}.`
  },
  SHIPPED_CONFIRMATION: {
    subject: "Your order {{order.orderNumber}} has shipped",
    html: `<h1>Your order is on the way, {{customer.name}}</h1>
<p>Order number: {{order.orderNumber}}</p>
<p>Ship to:</p>
<p>
  {{shippingAddress.name}}<br/>
  {{shippingAddress.line1}}<br/>
  {{shippingAddress.line2}}<br/>
  {{shippingAddress.city}}, {{shippingAddress.province}} {{shippingAddress.postalCode}}<br/>
  {{shippingAddress.country}}
</p>
<p>Tracking number: {{order.trackingNumber}}</p>
<ul>
{{#items}}<li>{{title}} x {{quantity}}</li>{{/items}}
</ul>`,
    text: `Your order {{order.orderNumber}} has shipped.
Ship to: {{shippingAddress.name}}, {{shippingAddress.line1}}, {{shippingAddress.line2}}, {{shippingAddress.city}}, {{shippingAddress.province}}, {{shippingAddress.postalCode}}, {{shippingAddress.country}}.
Tracking number: {{order.trackingNumber}}.`
  },
  DELIVERED_CONFIRMATION: {
    subject: "Your order {{order.orderNumber}} was delivered",
    html: `<h1>Your order has been delivered, {{customer.name}}</h1>
<p>Order number: {{order.orderNumber}}</p>
<p>Delivered items:</p>
<ul>
{{#items}}<li>{{title}} x {{quantity}}</li>{{/items}}
</ul>`,
    text: `Your order {{order.orderNumber}} was delivered.
Delivered items:
{{#items}}- {{title}} x {{quantity}}
{{/items}}`
  }
};

const LEGACY_ROUTE_TEMPLATE_DEFAULTS: Partial<Record<EmailRouteType, { subject: string; html: string; text: string }>> = {
  CUSTOMER_CONFIRMATION: {
    subject: "Order {{order.orderNumber}} confirmation",
    html: `<h1>Thanks for your order {{customer.name}}</h1>
<p>Order number: {{order.orderNumber}}</p>
<p>Total: {{order.totalCents}}</p>
<ul>
{{#items}}<li>{{title}} x {{quantity}} = {{lineSubtotalCents}}</li>{{/items}}
</ul>`,
    text: `Order {{order.orderNumber}} confirmed. Total {{order.totalCents}}.`
  },
  PACKING: {
    subject: "Packing slip for order {{order.orderNumber}}",
    html: `<h1>Packing required for order {{order.orderNumber}}</h1>
<p>Shipping method: {{shipping.methodType}}</p>
<ul>
{{#items}}<li>{{title}} ({{sku}}) x {{quantity}}</li>{{/items}}
</ul>`,
    text: `Pack order {{order.orderNumber}}.`
  },
  WAREHOUSE: {
    subject: "Warehouse notice for order {{order.orderNumber}}",
    html: `<h1>Warehouse action for order {{order.orderNumber}}</h1>
<p>Total: {{order.totalCents}}</p>
<ul>
{{#items}}<li>{{title}} x {{quantity}}</li>{{/items}}
</ul>`,
    text: `Warehouse notification for order {{order.orderNumber}}.`
  }
};

function ensureCustomerConfirmationIncludesManualPaymentInstruction(template: { html: string; text: string | null }) {
  const htmlToken = "{{payment.instructions}}";
  const nextHtml = template.html.includes(htmlToken) ? template.html : `${template.html}\n<p>${htmlToken}</p>`;

  const nextTextBase = template.text ?? "";
  const nextText = nextTextBase.includes(htmlToken)
    ? nextTextBase
    : `${nextTextBase}${nextTextBase ? "\n" : ""}${htmlToken}`;

  return {
    html: nextHtml,
    text: nextText
  };
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
  const seen = new Set<string>();
  const out: string[] = [];

  for (const raw of emails) {
    const normalized = raw.trim().toLowerCase();
    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    out.push(normalized);
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

function stringifyTemplateValue(value: unknown, path?: string): string {
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
    return String(value);
  }

  if (typeof value === "boolean") {
    return String(value);
  }

  return "";
}

function renderVariables(template: string, context: Record<string, unknown>, allowedPaths: Set<string>): string {
  return template.replace(/{{\s*([a-zA-Z0-9_.]+)\s*}}/g, (_m, path: string) => {
    if (!allowedPaths.has(path)) {
      return "";
    }

    return stringifyTemplateValue(readPath(context, path), path);
  });
}

function renderItemsSection(template: string, items: Array<Record<string, unknown>>): string {
  return template.replace(/{{#items}}([\s\S]*?){{\/items}}/g, (_m, block: string) => {
    return items
      .map((item) =>
        block.replace(/{{\s*([a-zA-Z0-9_.]+)\s*}}/g, (_x, path: string) => {
          if (!ITEM_ALLOWED_PATHS.has(path)) {
            return "";
          }

          return stringifyTemplateValue(readPath(item, path), path);
        })
      )
      .join("");
  });
}

function renderTemplateString(template: string, context: Record<string, unknown>): string {
  const items = Array.isArray(context.items) ? (context.items as Array<Record<string, unknown>>) : [];
  const withItems = renderItemsSection(template, items);
  return renderVariables(withItems, context, ROOT_ALLOWED_PATHS);
}

function mapRoute(route: any) {
  return {
    id: route.id,
    type: route.type,
    enabled: route.enabled
  };
}

function mapRecipients(recipients: any[]) {
  return {
    to: dedupeEmails(recipients.filter((item) => item.kind === "TO").map((item) => item.email)),
    cc: dedupeEmails(recipients.filter((item) => item.kind === "CC").map((item) => item.email)),
    bcc: dedupeEmails(recipients.filter((item) => item.kind === "BCC").map((item) => item.email))
  };
}

async function getRouteByTypeOrThrow(storeId: string, type: EmailRouteType) {
  const route = await db.emailRoute.findUnique({
    where: {
      storeId_type: {
        storeId,
        type
      }
    }
  });

  if (!route) {
    throw badRequest("Email route not found", "EMAIL_ROUTE_NOT_FOUND");
  }

  return route;
}

function buildMockContext(type: EmailRouteType) {
  const etransferEmail = "payments@example.com";
  return {
    order: {
      orderNumber: "100001",
      totalCents: 12900,
      subtotalCents: 12000,
      discountCents: 1000,
      taxCents: 900,
      shippingCents: 1000,
      trackingNumber: "1Z999AA10123456784"
    },
    customer: {
      email: "customer@example.com",
      name: "Sample Customer"
    },
    shipping: {
      methodType: type === "CUSTOMER_CONFIRMATION" ? "FLAT_RATE" : "PICKUP"
    },
    shippingAddress: {
      name: "Sample Customer",
      line1: "123 Main St",
      line2: "",
      city: "Vancouver",
      province: "BC",
      country: "CA",
      postalCode: "V5K0A1",
      phone: ""
    },
    payment: {
      method: type === "CUSTOMER_CONFIRMATION" ? "OTHER" : "STRIPE",
      etransferEmail: type === "CUSTOMER_CONFIRMATION" ? etransferEmail : "",
      instructions:
        type === "CUSTOMER_CONFIRMATION"
          ? `Please send your e-transfer to ${etransferEmail}. Include order number 100001 in the memo.`
          : ""
    },
    items: [
      {
        title: "Sample Item",
        sku: "SKU-001",
        quantity: 2,
        unitPriceCents: 6000,
        lineSubtotalCents: 12000
      }
    ]
  };
}

async function buildOrderContext(storeId: string, orderId: string) {
  const order = await db.order.findFirst({
    where: {
      id: orderId,
      storeId
    },
    include: {
      customer: {
        select: {
          email: true,
          name: true
        }
      },
      shippingAddress: true,
      items: {
        orderBy: [{ id: "asc" }]
      },
      payments: {
        where: { status: "SUCCEEDED" },
        orderBy: [{ createdAt: "desc" }],
        take: 1
      }
    }
  });

  if (!order) {
    throw badRequest("Order not found", "ORDER_NOT_FOUND");
  }

  let manualPaymentEmail = "";
  const successfulPayment = order.payments?.[0];
  if (successfulPayment?.provider === "OTHER") {
    const manualSetting = await db.paymentProviderSetting.findUnique({
      where: { storeId_provider: { storeId, provider: "OTHER" } }
    });
    if (manualSetting?.configEncrypted) {
      try {
        const config = decryptJson<{ manualPaymentEmail?: string }>(manualSetting.configEncrypted, process.env.APP_ENCRYPTION_KEY || "");
        manualPaymentEmail = (config.manualPaymentEmail || "").trim();
      } catch {
        manualPaymentEmail = "";
      }
    }
  }

  return {
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
}

function resolveRecipients(
  routeType: EmailRouteType,
  recipients: { to: string[]; cc: string[]; bcc: string[] },
  customerEmail: string
) {
  if (
    routeType === "CUSTOMER_CONFIRMATION" ||
    routeType === "SHIPPED_CONFIRMATION" ||
    routeType === "DELIVERED_CONFIRMATION"
  ) {
    return {
      to: dedupeEmails([customerEmail]),
      cc: recipients.cc,
      bcc: recipients.bcc
    };
  }

  return {
    to: recipients.to,
    cc: recipients.cc,
    bcc: recipients.bcc
  };
}

export const emailTemplateService = {
  async ensureDefaults(storeId: string) {
    for (const type of EMAIL_ROUTE_TYPES) {
      const route = await db.emailRoute.upsert({
        where: {
          storeId_type: {
            storeId,
            type
          }
        },
        create: {
          storeId,
          type,
          enabled: true
        },
        update: {}
      });

      const defaults = ROUTE_TEMPLATE_DEFAULTS[type];
      await db.emailTemplate.upsert({
        where: {
          routeId: route.id
        },
        create: {
          storeId,
          routeId: route.id,
          subject: defaults.subject,
          html: defaults.html,
          text: defaults.text
        },
        update: {}
      });

      const legacyDefaults = LEGACY_ROUTE_TEMPLATE_DEFAULTS[type];
      if (legacyDefaults) {
        await db.emailTemplate.updateMany({
          where: {
            routeId: route.id,
            subject: legacyDefaults.subject,
            html: legacyDefaults.html
          },
          data: {
            subject: defaults.subject,
            html: defaults.html,
            text: defaults.text
          }
        });
      }

      if (type === "CUSTOMER_CONFIRMATION") {
        const currentTemplate = await db.emailTemplate.findUnique({
          where: {
            routeId: route.id
          },
          select: {
            html: true,
            text: true
          }
        });

        if (currentTemplate) {
          const next = ensureCustomerConfirmationIncludesManualPaymentInstruction(currentTemplate);
          if (next.html !== currentTemplate.html || next.text !== (currentTemplate.text ?? "")) {
            await db.emailTemplate.update({
              where: {
                routeId: route.id
              },
              data: {
                html: next.html,
                text: next.text
              }
            });
          }
        }
      }
    }
  },

  async listRoutes(storeId: string) {
    await this.ensureDefaults(storeId);

    const routes = await db.emailRoute.findMany({
      where: { storeId },
      orderBy: [{ type: "asc" }]
    });

    return {
      items: routes.map(mapRoute)
    };
  },

  async updateRoute(storeId: string, type: EmailRouteType, enabled: boolean) {
    await this.ensureDefaults(storeId);

    const route = await getRouteByTypeOrThrow(storeId, type);

    const updated = await db.emailRoute.update({
      where: { id: route.id },
      data: { enabled }
    });

    return mapRoute(updated);
  },

  async getRecipientsByRouteType(storeId: string, type: EmailRouteType) {
    await this.ensureDefaults(storeId);

    const route = await getRouteByTypeOrThrow(storeId, type);
    const recipients = await db.emailRecipient.findMany({
      where: { routeId: route.id },
      orderBy: [{ kind: "asc" }, { email: "asc" }]
    });

    return mapRecipients(recipients);
  },

  async setRecipientsByRouteType(
    storeId: string,
    type: EmailRouteType,
    recipients: { to: string[]; cc: string[]; bcc: string[] }
  ) {
    await this.ensureDefaults(storeId);

    const route = await getRouteByTypeOrThrow(storeId, type);
    const nextRecipients = {
      to: dedupeEmails(recipients.to),
      cc: dedupeEmails(recipients.cc),
      bcc: dedupeEmails(recipients.bcc)
    };

    await db.$transaction(async (tx: any) => {
      await tx.emailRecipient.deleteMany({
        where: {
          routeId: route.id
        }
      });

      const rows = [
        ...nextRecipients.to.map((email) => ({ storeId, routeId: route.id, kind: "TO", email })),
        ...nextRecipients.cc.map((email) => ({ storeId, routeId: route.id, kind: "CC", email })),
        ...nextRecipients.bcc.map((email) => ({ storeId, routeId: route.id, kind: "BCC", email }))
      ];

      if (rows.length > 0) {
        await tx.emailRecipient.createMany({
          data: rows,
          skipDuplicates: true
        });
      }
    });

    return nextRecipients;
  },

  async getTemplateByRouteType(storeId: string, type: EmailRouteType) {
    await this.ensureDefaults(storeId);

    const route = await getRouteByTypeOrThrow(storeId, type);
    const template = await db.emailTemplate.findUnique({
      where: {
        routeId: route.id
      }
    });

    if (!template) {
      throw badRequest("Email template not found", "EMAIL_TEMPLATE_NOT_FOUND");
    }

    return {
      subject: template.subject,
      html: template.html,
      text: template.text
    };
  },

  async setTemplateByRouteType(
    storeId: string,
    type: EmailRouteType,
    input: { subject: string; html: string; text?: string }
  ) {
    await this.ensureDefaults(storeId);

    const route = await getRouteByTypeOrThrow(storeId, type);
    const template = await db.emailTemplate.upsert({
      where: {
        routeId: route.id
      },
      create: {
        storeId,
        routeId: route.id,
        subject: input.subject,
        html: input.html,
        text: input.text ?? null
      },
      update: {
        subject: input.subject,
        html: input.html,
        text: input.text ?? null
      }
    });

    return {
      subject: template.subject,
      html: template.html,
      text: template.text
    };
  },

  async previewByRouteType(storeId: string, type: EmailRouteType, orderId?: string) {
    await this.ensureDefaults(storeId);

    const [route, template, recipientsRaw] = await Promise.all([
      getRouteByTypeOrThrow(storeId, type),
      this.getTemplateByRouteType(storeId, type),
      this.getRecipientsByRouteType(storeId, type)
    ]);

    const context = orderId ? await buildOrderContext(storeId, orderId) : buildMockContext(type);

    const resolvedRecipients = resolveRecipients(type, recipientsRaw, context.customer.email);

    return {
      route: mapRoute(route),
      rendered: {
        subject: renderTemplateString(template.subject, context),
        html: renderTemplateString(template.html, context),
        text: template.text ? renderTemplateString(template.text, context) : null
      },
      resolvedRecipients
    };
  }
};

export function renderEmailTemplateWithStrictContext(template: string, context: Record<string, unknown>): string {
  return renderTemplateString(template, context);
}

export function resolveEmailRecipients(
  routeType: EmailRouteType,
  configuredRecipients: { to: string[]; cc: string[]; bcc: string[] },
  customerEmail: string
) {
  return resolveRecipients(routeType, configuredRecipients, customerEmail);
}
