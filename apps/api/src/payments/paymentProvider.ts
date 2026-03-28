import { prisma } from "@ecom/db";
import type { ApiEnv } from "@ecom/shared";
import { decryptJson } from "../lib/crypto.js";
import { badRequest } from "../lib/errors.js";
import { StripePaymentProvider } from "./stripeProvider.js";

const db = prisma as any;

export interface CreatePaymentIntentInput {
  amountCents: number;
  currency: string;
  cartId: string;
  customerId: string;
  customerEmail: string;
  metadata?: Record<string, string>;
}

export interface CreatePaymentIntentResult {
  clientSecret: string;
  providerPaymentIntentId: string;
  amountCents: number;
  provider: "STRIPE" | "PAYPAL" | "OTHER";
}

export interface PaymentIntentStatus {
  succeeded: boolean;
  status: string;
  providerPaymentIntentId: string;
  providerChargeId?: string;
  amountCents: number;
  currency: string;
  provider: "STRIPE" | "PAYPAL" | "OTHER";
}

export interface CreateRefundInput {
  providerPaymentIntentId: string;
  amountCents: number;
  reason?: string;
}

export interface CreateRefundResult {
  providerRefundId?: string;
  status: "SUCCEEDED" | "FAILED" | "PENDING";
}

export interface PaymentProvider {
  createPaymentIntent(input: CreatePaymentIntentInput): Promise<CreatePaymentIntentResult>;
  verifyPaymentSucceeded(providerPaymentIntentId: string): Promise<PaymentIntentStatus>;
  createRefund(input: CreateRefundInput): Promise<CreateRefundResult>;
}

interface StripeProviderConfig {
  secretKey: string;
  testMode?: boolean;
}

class OfflinePaymentProvider implements PaymentProvider {
  constructor(private readonly provider: "PAYPAL" | "OTHER") {}

  async createPaymentIntent(input: CreatePaymentIntentInput): Promise<CreatePaymentIntentResult> {
    const id = `${this.provider.toLowerCase()}_manual_${input.amountCents}_${Date.now()}`;
    return {
      clientSecret: `${id}_secret`,
      providerPaymentIntentId: id,
      amountCents: input.amountCents,
      provider: this.provider
    };
  }

  async verifyPaymentSucceeded(providerPaymentIntentId: string): Promise<PaymentIntentStatus> {
    const parts = providerPaymentIntentId.split("_");
    const parsedAmount = Number(parts[2]);
    const amountCents = Number.isFinite(parsedAmount) ? parsedAmount : 0;

    return {
      succeeded: true,
      status: "succeeded",
      providerPaymentIntentId,
      amountCents,
      currency: "CAD",
      provider: this.provider
    };
  }

  async createRefund(_input: CreateRefundInput): Promise<CreateRefundResult> {
    return {
      providerRefundId: undefined,
      status: "FAILED"
    };
  }
}

function resolveStripeSecret(config: StripeProviderConfig | null, env: ApiEnv): string {
  const secretKey = config?.secretKey ?? env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw badRequest("Stripe provider is not configured", "PAYMENT_PROVIDER_NOT_CONFIGURED");
  }
  return secretKey;
}

export async function loadPaymentProvider(
  storeId: string,
  env: ApiEnv,
  preferredProvider?: "STRIPE" | "PAYPAL" | "OTHER"
): Promise<PaymentProvider> {
  if (preferredProvider === "PAYPAL") {
    // Keep legacy order operations resilient while preventing PayPal from active checkout selection.
    return new OfflinePaymentProvider("PAYPAL");
  }

  const settings = await db.paymentProviderSetting.findMany({
    where: {
      storeId
    }
  });

  const parsed = settings.map((setting: any) => {
    const config = setting.configEncrypted
      ? decryptJson<{ secretKey?: string; active?: boolean }>(setting.configEncrypted, env.APP_ENCRYPTION_KEY)
      : {};
    return {
      setting,
      active: Boolean(config.active),
      config
    };
  });

  const available = parsed.filter((entry: any) => entry.setting.provider !== "PAYPAL");
  const selected =
    (preferredProvider
      ? available.find((entry: any) => entry.setting.provider === preferredProvider)
      : available.find((entry: any) => entry.active && entry.setting.enabled)) ??
    available.find((entry: any) => entry.setting.provider === "STRIPE");

  if (!selected) {
    throw badRequest("Payment provider is not configured", "PAYMENT_PROVIDER_NOT_CONFIGURED");
  }

  if (!selected.setting.enabled) {
    throw badRequest("Payment provider is disabled", "PAYMENT_PROVIDER_DISABLED");
  }

  if (selected.setting.provider === "STRIPE") {
    const secretKey = resolveStripeSecret(selected.config as StripeProviderConfig, env);
    return new StripePaymentProvider(secretKey, (selected.config as StripeProviderConfig).testMode ?? true);
  }

  if (selected.setting.provider === "PAYPAL") {
    return new OfflinePaymentProvider("PAYPAL");
  }

  return new OfflinePaymentProvider("OTHER");
}
