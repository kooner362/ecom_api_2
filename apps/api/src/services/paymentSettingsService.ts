import { prisma } from "@ecom/db";
import type { ApiEnv } from "@ecom/shared";
import { decryptJson, encryptJson } from "../lib/crypto.js";
import { badRequest } from "../lib/errors.js";

const db = prisma as any;

const PROVIDERS = ["stripe", "other"] as const;
type UiProvider = (typeof PROVIDERS)[number];

function toDbProvider(provider: UiProvider) {
  if (provider === "stripe") return "STRIPE";
  return "OTHER";
}

function fromDbProvider(provider: string): UiProvider | null {
  if (provider === "STRIPE") return "stripe";
  if (provider === "OTHER") return "other";
  return null;
}

interface ProviderConfig {
  publicKey?: string;
  secretKey?: string;
  testMode?: boolean;
  active?: boolean;
  manualPaymentEmail?: string;
}

async function ensureDefaultSettings(storeId: string, env: ApiEnv) {
  for (const provider of PROVIDERS) {
    const dbProvider = toDbProvider(provider);
    const defaultConfig =
      provider === "stripe"
        ? {
            publicKey: "",
            secretKey: env.STRIPE_SECRET_KEY || "",
            testMode: true,
            active: true
          }
        : {
            publicKey: "",
            secretKey: "",
            testMode: true,
            active: false
          };

    await db.paymentProviderSetting.upsert({
      where: {
        storeId_provider: {
          storeId,
          provider: dbProvider
        }
      },
      create: {
        storeId,
        provider: dbProvider,
        enabled: provider === "stripe",
        configEncrypted: encryptJson(defaultConfig, env.APP_ENCRYPTION_KEY) as any
      },
      update: {}
    });
  }
}

function mapSetting(setting: any, env: ApiEnv) {
  const provider = fromDbProvider(setting.provider);
  if (!provider) {
    return null;
  }

  const config = setting.configEncrypted
    ? decryptJson<ProviderConfig>(setting.configEncrypted, env.APP_ENCRYPTION_KEY)
    : {};

  return {
    id: provider,
    name: provider === "stripe" ? "Stripe" : "Other / Manual",
    enabled: setting.enabled,
    active: Boolean(config.active),
    publicKey: config.publicKey || "",
    manualPaymentEmail: config.manualPaymentEmail || "",
    testMode: config.testMode ?? true
  };
}

export const paymentSettingsService = {
  async list(storeId: string, env: ApiEnv) {
    await ensureDefaultSettings(storeId, env);
    const settings = await db.paymentProviderSetting.findMany({
      where: { storeId },
      orderBy: [{ provider: "asc" }]
    });
    return settings
      .map((setting: any) => mapSetting(setting, env))
      .filter((item: any) => Boolean(item));
  },

  async update(
    storeId: string,
    env: ApiEnv,
    provider: UiProvider,
    input: {
      enabled?: boolean;
      publicKey?: string;
      secretKey?: string;
      testMode?: boolean;
      manualPaymentEmail?: string | null;
    }
  ) {
    const dbProvider = toDbProvider(provider);
    const existing = await db.paymentProviderSetting.findUnique({
      where: { storeId_provider: { storeId, provider: dbProvider } }
    });

    const existingConfig: ProviderConfig =
      existing?.configEncrypted ? decryptJson(existing.configEncrypted, env.APP_ENCRYPTION_KEY) : {};

    const nextConfig: ProviderConfig = {
      ...existingConfig,
      ...(input.publicKey !== undefined ? { publicKey: input.publicKey } : {}),
      ...(input.secretKey !== undefined ? { secretKey: input.secretKey } : {}),
      ...(input.testMode !== undefined ? { testMode: input.testMode } : {}),
      ...(input.manualPaymentEmail !== undefined
        ? { manualPaymentEmail: input.manualPaymentEmail ?? "" }
        : {})
    };

    const setting = await db.paymentProviderSetting.upsert({
      where: { storeId_provider: { storeId, provider: dbProvider } },
      create: {
        storeId,
        provider: dbProvider,
        enabled: input.enabled ?? true,
        configEncrypted: encryptJson({ ...nextConfig, active: false }, env.APP_ENCRYPTION_KEY) as any
      },
      update: {
        enabled: input.enabled ?? existing?.enabled ?? true,
        configEncrypted: encryptJson(
          { ...nextConfig, active: existingConfig.active ?? true },
          env.APP_ENCRYPTION_KEY
        ) as any
      }
    });

    return mapSetting(setting, env);
  },

  async activate(storeId: string, env: ApiEnv, provider: UiProvider) {
    const dbProvider = toDbProvider(provider);
    const setting = await db.paymentProviderSetting.findUnique({
      where: { storeId_provider: { storeId, provider: dbProvider } }
    });
    if (!setting) {
      throw badRequest("Payment provider is not configured", "PAYMENT_PROVIDER_NOT_CONFIGURED");
    }

    const allSettings = await db.paymentProviderSetting.findMany({
      where: { storeId }
    });

    for (const entry of allSettings) {
      const entryConfig = entry.configEncrypted
        ? decryptJson<ProviderConfig>(entry.configEncrypted, env.APP_ENCRYPTION_KEY)
        : {};

      await db.paymentProviderSetting.update({
        where: { id: entry.id },
        data: {
          configEncrypted: encryptJson(
            { ...entryConfig, active: entry.provider === dbProvider ? true : false },
            env.APP_ENCRYPTION_KEY
          ) as any
        }
      });
    }

    const updated = await db.paymentProviderSetting.findUnique({
      where: { id: setting.id }
    });
    if (!updated) {
      throw badRequest("Payment provider is not configured", "PAYMENT_PROVIDER_NOT_CONFIGURED");
    }
    return mapSetting(updated, env);
  },

  async listPublic(storeId: string, env: ApiEnv) {
    await ensureDefaultSettings(storeId, env);
    const settings = await db.paymentProviderSetting.findMany({
      where: { storeId, enabled: true },
      orderBy: [{ provider: "asc" }]
    });

    return settings
      .map((setting: any) => mapSetting(setting, env))
      .filter((mapped: any) => Boolean(mapped))
      .map((mapped: any) => ({
        id: mapped.id,
        name: mapped.name,
        enabled: mapped.enabled,
        active: mapped.active,
        testMode: mapped.testMode
      }));
  }
};

export { PROVIDERS };
