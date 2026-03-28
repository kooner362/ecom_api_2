import { prisma } from "@ecom/db";
import { badRequest } from "../lib/errors.js";

const db = prisma as any;

export type ShippingMethodType = "FLAT_RATE" | "LOCAL_DELIVERY" | "PICKUP";

export interface ShippingAddressInput {
  postalCode?: string;
  province?: string;
  country?: string;
}

export interface UpdateShippingMethodInput {
  enabled?: boolean;
  name?: string;
  configJson?: Record<string, unknown>;
}

const DEFAULT_SHIPPING_METHODS: Array<{
  type: ShippingMethodType;
  name: string;
  configJson: Record<string, unknown>;
}> = [
  {
    type: "FLAT_RATE",
    name: "Standard Shipping",
    configJson: { amountCents: 0 }
  },
  {
    type: "LOCAL_DELIVERY",
    name: "Local Delivery",
    configJson: { amountCents: 0, postalPrefixes: [] }
  },
  {
    type: "PICKUP",
    name: "Pickup",
    configJson: { instructions: "" }
  }
];

function toUpperTrimmed(value?: string | null): string {
  return (value ?? "").trim().toUpperCase();
}

function normalizePostalCode(value?: string | null): string {
  return toUpperTrimmed(value).replace(/\s+/g, "");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseFlatRateConfig(configJson: unknown) {
  if (!isRecord(configJson)) {
    throw badRequest("configJson must be an object", "INVALID_SHIPPING_CONFIG");
  }

  const amountCents = configJson.amountCents;
  if (!Number.isInteger(amountCents) || (amountCents as number) < 0) {
    throw badRequest("configJson.amountCents must be a non-negative integer", "INVALID_SHIPPING_CONFIG");
  }
}

function parseLocalDeliveryConfig(configJson: unknown) {
  if (!isRecord(configJson)) {
    throw badRequest("configJson must be an object", "INVALID_SHIPPING_CONFIG");
  }

  const amountCents = configJson.amountCents;
  if (!Number.isInteger(amountCents) || (amountCents as number) < 0) {
    throw badRequest("configJson.amountCents must be a non-negative integer", "INVALID_SHIPPING_CONFIG");
  }

  if (configJson.postalPrefixes !== undefined) {
    if (!Array.isArray(configJson.postalPrefixes)) {
      throw badRequest("configJson.postalPrefixes must be an array of strings", "INVALID_SHIPPING_CONFIG");
    }

    for (const prefix of configJson.postalPrefixes) {
      if (typeof prefix !== "string" || prefix.trim().length === 0) {
        throw badRequest("configJson.postalPrefixes must contain non-empty strings", "INVALID_SHIPPING_CONFIG");
      }
    }
  }
}

function parsePickupConfig(configJson: unknown) {
  if (!isRecord(configJson)) {
    throw badRequest("configJson must be an object", "INVALID_SHIPPING_CONFIG");
  }

  if (configJson.instructions !== undefined && typeof configJson.instructions !== "string") {
    throw badRequest("configJson.instructions must be a string", "INVALID_SHIPPING_CONFIG");
  }
}

function validateMethodConfig(type: ShippingMethodType, configJson: unknown) {
  if (type === "FLAT_RATE") {
    parseFlatRateConfig(configJson);
    return;
  }

  if (type === "LOCAL_DELIVERY") {
    parseLocalDeliveryConfig(configJson);
    return;
  }

  parsePickupConfig(configJson);
}

function mapShippingMethod(method: any) {
  return {
    id: method.id,
    type: method.type as ShippingMethodType,
    name: method.name,
    enabled: method.enabled,
    configJson: method.configJson,
    createdAt: method.createdAt,
    updatedAt: method.updatedAt
  };
}

function normalizeMethodConfig(type: ShippingMethodType, configJson: unknown): Record<string, unknown> {
  if (!isRecord(configJson)) {
    return {};
  }

  if (type === "LOCAL_DELIVERY") {
    const postalPrefixes = Array.isArray(configJson.postalPrefixes)
      ? configJson.postalPrefixes
          .filter((value): value is string => typeof value === "string")
          .map((value) => normalizePostalCode(value))
          .filter((value) => value.length > 0)
      : undefined;

    return {
      ...configJson,
      ...(postalPrefixes ? { postalPrefixes } : {})
    };
  }

  return configJson;
}

export const shippingService = {
  async ensureDefaultShippingMethods(storeId: string) {
    for (const method of DEFAULT_SHIPPING_METHODS) {
      await db.shippingMethod.upsert({
        where: {
          storeId_type: {
            storeId,
            type: method.type
          }
        },
        create: {
          storeId,
          type: method.type,
          name: method.name,
          enabled: false,
          configJson: method.configJson
        },
        update: {}
      });
    }
  },

  async listShippingMethods(storeId: string) {
    await this.ensureDefaultShippingMethods(storeId);

    const methods = await db.shippingMethod.findMany({
      where: { storeId },
      orderBy: [{ type: "asc" }]
    });

    return {
      items: methods.map(mapShippingMethod)
    };
  },

  async updateShippingMethod(storeId: string, type: ShippingMethodType, input: UpdateShippingMethodInput) {
    await this.ensureDefaultShippingMethods(storeId);

    const method = await db.shippingMethod.findUnique({
      where: {
        storeId_type: {
          storeId,
          type
        }
      }
    });

    if (!method) {
      throw badRequest("Shipping method not found", "SHIPPING_METHOD_NOT_FOUND");
    }

    const nextConfig = input.configJson ?? (method.configJson as Record<string, unknown>);
    const normalizedConfig = normalizeMethodConfig(type, nextConfig);

    const enabling = input.enabled === true || method.enabled;
    if (enabling && (type === "FLAT_RATE" || type === "LOCAL_DELIVERY")) {
      validateMethodConfig(type, normalizedConfig);
    } else if (input.configJson !== undefined) {
      validateMethodConfig(type, normalizedConfig);
    }

    const updated = await db.shippingMethod.update({
      where: { id: method.id },
      data: {
        enabled: input.enabled ?? method.enabled,
        name: input.name ?? method.name,
        configJson: normalizedConfig
      }
    });

    return mapShippingMethod(updated);
  },

  async getEnabledShippingMethods(storeId: string, address: ShippingAddressInput) {
    await this.ensureDefaultShippingMethods(storeId);

    const methods = await db.shippingMethod.findMany({
      where: {
        storeId,
        enabled: true
      },
      orderBy: [{ type: "asc" }]
    });

    const normalizedPostalCode = normalizePostalCode(address.postalCode);

    const items = methods.filter((method: any) => {
      if (method.type !== "LOCAL_DELIVERY") {
        return true;
      }

      const config = isRecord(method.configJson) ? method.configJson : {};
      const postalPrefixes = Array.isArray(config.postalPrefixes)
        ? config.postalPrefixes.filter((value: unknown): value is string => typeof value === "string")
        : [];

      if (postalPrefixes.length === 0) {
        return true;
      }

      if (!normalizedPostalCode) {
        return false;
      }

      return postalPrefixes.some((prefix: string) => normalizedPostalCode.startsWith(normalizePostalCode(prefix)));
    });

    return {
      items: items.map(mapShippingMethod)
    };
  },

  async getEnabledShippingMethodByType(storeId: string, type: ShippingMethodType, address: ShippingAddressInput) {
    const result = await this.getEnabledShippingMethods(storeId, address);
    const method = result.items.find((item: any) => item.type === type);
    if (!method) {
      throw badRequest("Shipping method is not available", "SHIPPING_METHOD_UNAVAILABLE");
    }
    return method;
  }
};
