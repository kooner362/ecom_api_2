import {
  type CreatePaymentIntentInput,
  type CreatePaymentIntentResult,
  type PaymentIntentStatus,
  type CreateRefundInput,
  type CreateRefundResult,
  type PaymentProvider
} from "./paymentProvider.js";

function toMinorCurrency(currency: string): string {
  return currency.toLowerCase();
}

function toFormBody(data: Record<string, string | number | undefined>): URLSearchParams {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) {
      continue;
    }
    body.append(key, String(value));
  }
  return body;
}

function toStripeRefundReason(reason?: string): "duplicate" | "fraudulent" | "requested_by_customer" | undefined {
  if (!reason) return undefined;
  const normalized = reason.trim().toLowerCase();
  if (!normalized) return undefined;
  if (normalized === "duplicate" || normalized.includes("duplicate")) return "duplicate";
  if (normalized === "fraudulent" || normalized.includes("fraud")) return "fraudulent";
  if (normalized === "requested_by_customer") return "requested_by_customer";
  if (normalized.includes("customer") || normalized.includes("cancel")) return "requested_by_customer";
  return undefined;
}

async function stripeRequest<T>(secretKey: string, path: string, method: "GET" | "POST", body?: URLSearchParams): Promise<T> {
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      ...(method === "POST" ? { "Content-Type": "application/x-www-form-urlencoded" } : {})
    },
    body
  });

  const json = (await response.json()) as any;
  if (!response.ok) {
    const message = json?.error?.message ?? `Stripe API request failed: ${response.status}`;
    throw new Error(message);
  }

  return json as T;
}

export class StripePaymentProvider implements PaymentProvider {
  constructor(
    private readonly secretKey: string,
    private readonly testMode: boolean = true
  ) {}

  private mapPaymentIntent(pi: any): PaymentIntentStatus {
    return {
      succeeded: pi.status === "succeeded" || pi.status === "requires_capture",
      status: pi.status,
      providerPaymentIntentId: pi.id,
      providerChargeId: pi.latest_charge ?? undefined,
      amountCents: pi.amount_received ?? pi.amount,
      currency: typeof pi.currency === "string" ? pi.currency.toUpperCase() : "CAD",
      provider: "STRIPE"
    };
  }

  async createPaymentIntent(input: CreatePaymentIntentInput): Promise<CreatePaymentIntentResult> {
    const metadataEntries = Object.entries(input.metadata ?? {});
    const metadata: Record<string, string> = {};
    for (const [key, value] of metadataEntries) {
      metadata[`metadata[${key}]`] = value;
    }

    const payload = toFormBody({
      amount: input.amountCents,
      currency: toMinorCurrency(input.currency),
      "automatic_payment_methods[enabled]": "true",
      "metadata[cartId]": input.cartId,
      "metadata[customerId]": input.customerId,
      "metadata[customerEmail]": input.customerEmail,
      ...metadata
    });

    const pi = await stripeRequest<any>(this.secretKey, "payment_intents", "POST", payload);

    return {
      clientSecret: pi.client_secret,
      providerPaymentIntentId: pi.id,
      amountCents: pi.amount,
      provider: "STRIPE"
    };
  }

  async verifyPaymentSucceeded(providerPaymentIntentId: string): Promise<PaymentIntentStatus> {
    let pi = await stripeRequest<any>(this.secretKey, `payment_intents/${providerPaymentIntentId}`, "GET");
    let mapped = this.mapPaymentIntent(pi);
    if (mapped.succeeded) {
      return mapped;
    }

    // Demo fallback: in Stripe test mode, auto-confirm incomplete intents so
    // checkout can proceed without a full client-side Stripe Elements flow.
    if (
      this.testMode &&
      ["requires_payment_method", "requires_confirmation", "requires_action", "processing"].includes(pi.status)
    ) {
      const confirmPayload = toFormBody({
        payment_method: "pm_card_visa",
        off_session: "true"
      });
      pi = await stripeRequest<any>(
        this.secretKey,
        `payment_intents/${providerPaymentIntentId}/confirm`,
        "POST",
        confirmPayload
      );
      mapped = this.mapPaymentIntent(pi);
    }

    return mapped;
  }

  async createRefund(input: CreateRefundInput): Promise<CreateRefundResult> {
    const stripeReason = toStripeRefundReason(input.reason);
    const payload = toFormBody({
      payment_intent: input.providerPaymentIntentId,
      amount: input.amountCents,
      reason: stripeReason
    });

    const refund = await stripeRequest<any>(this.secretKey, "refunds", "POST", payload);

    const status: "SUCCEEDED" | "FAILED" | "PENDING" =
      refund.status === "succeeded" ? "SUCCEEDED" : refund.status === "failed" ? "FAILED" : "PENDING";

    return {
      providerRefundId: refund.id,
      status
    };
  }
}
