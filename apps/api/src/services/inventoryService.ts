import { Queue } from "bullmq";
import { prisma } from "@ecom/db";
import { EVENT_JOB_INVENTORY_LOW, type InventoryLowEventPayload } from "@ecom/shared";
import { badRequest } from "../lib/errors.js";

const db = prisma as any;
type Tx = any;

const LOW_STOCK_EVENT_JOB_PREFIX = "inventory-low";

export interface CreateLocationInput {
  name: string;
  code?: string;
  address?: string;
  isActive?: boolean;
}

export interface UpdateLocationInput {
  name?: string;
  address?: string | null;
  isActive?: boolean;
}

export interface GetInventoryInput {
  variantId?: string;
  locationId?: string;
}

export interface AdjustInventoryInput {
  variantId: string;
  locationId: string;
  delta: number;
  note?: string;
}

export interface SetThresholdInput {
  variantId: string;
  locationId: string;
  threshold: number;
}

function normalizeLocationCode(code: string): string {
  return code.trim().toUpperCase();
}

function codeFromName(name: string): string {
  const normalized = name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || "LOCATION";
}

async function generateUniqueLocationCode(tx: Tx, storeId: string, source: string) {
  const base = normalizeLocationCode(source);
  let attempt = 0;

  while (attempt < 1000) {
    const code = attempt === 0 ? base : `${base}-${attempt + 1}`;
    const existing = await tx.location.findFirst({
      where: { storeId, code },
      select: { id: true }
    });

    if (!existing) {
      return code;
    }

    attempt += 1;
  }

  throw badRequest("Unable to generate unique location code", "LOCATION_CODE_GENERATION_FAILED");
}

function mapLocation(location: any) {
  return {
    id: location.id,
    name: location.name,
    code: location.code,
    address: location.address,
    isActive: location.isActive,
    createdAt: location.createdAt
  };
}

async function ensureVariantExists(tx: Tx, storeId: string, variantId: string) {
  const variant = await tx.productVariant.findFirst({
    where: { id: variantId, storeId },
    select: { id: true }
  });

  if (!variant) {
    throw badRequest("Variant not found", "VARIANT_NOT_FOUND");
  }
}

async function ensureLocationExists(tx: Tx, storeId: string, locationId: string) {
  const location = await tx.location.findFirst({
    where: { id: locationId, storeId },
    select: { id: true }
  });

  if (!location) {
    throw badRequest("Location not found", "LOCATION_NOT_FOUND");
  }
}

export function createInventoryService(eventsQueue: Queue) {
  return {
    async createLocation(storeId: string, input: CreateLocationInput) {
      const location = await db.$transaction(async (tx: Tx) => {
        const requestedCode = input.code?.trim();
        const code = requestedCode
          ? normalizeLocationCode(requestedCode)
          : await generateUniqueLocationCode(tx, storeId, codeFromName(input.name));

        if (requestedCode) {
          const existing = await tx.location.findFirst({
            where: { storeId, code },
            select: { id: true }
          });
          if (existing) {
            throw badRequest("Location code already exists", "LOCATION_CODE_EXISTS");
          }
        }

        return tx.location.create({
          data: {
            storeId,
            name: input.name,
            code,
            address: input.address,
            isActive: input.isActive ?? true
          }
        });
      });

      return mapLocation(location);
    },

    async listLocations(storeId: string) {
      const locations = await db.location.findMany({
        where: { storeId },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }]
      });

      return locations.map(mapLocation);
    },

    async updateLocation(storeId: string, id: string, input: UpdateLocationInput) {
      const location = await db.location.findFirst({ where: { id, storeId } });
      if (!location) {
        throw badRequest("Location not found", "LOCATION_NOT_FOUND");
      }

      const updated = await db.location.update({
        where: { id },
        data: {
          name: input.name ?? location.name,
          address: input.address === undefined ? location.address : input.address,
          isActive: input.isActive ?? location.isActive
        }
      });

      return mapLocation(updated);
    },

    async deactivateLocation(storeId: string, id: string) {
      const location = await db.location.findFirst({ where: { id, storeId } });
      if (!location) {
        throw badRequest("Location not found", "LOCATION_NOT_FOUND");
      }

      await db.location.update({
        where: { id },
        data: { isActive: false }
      });

      return { ok: true, deactivated: true };
    },

    async getInventory(storeId: string, input: GetInventoryInput) {
      const levelWhere = {
        storeId,
        ...(input.variantId ? { variantId: input.variantId } : {}),
        ...(input.locationId ? { locationId: input.locationId } : {})
      };

      const thresholdWhere = {
        storeId,
        ...(input.variantId ? { variantId: input.variantId } : {}),
        ...(input.locationId ? { locationId: input.locationId } : {})
      };

      const [levels, thresholds] = await Promise.all([
        db.inventoryLevel.findMany({
          where: levelWhere,
          orderBy: [{ variantId: "asc" }, { locationId: "asc" }]
        }),
        db.lowStockThreshold.findMany({
          where: thresholdWhere
        })
      ]);

      const thresholdByKey = new Map<string, number>();
      for (const threshold of thresholds) {
        const key = `${threshold.variantId}:${threshold.locationId}`;
        thresholdByKey.set(key, threshold.threshold);
      }

      const levelByKey = new Map<string, any>();
      const items = levels.map((level: any) => {
        const key = `${level.variantId}:${level.locationId}`;
        levelByKey.set(key, true);

        return {
          id: level.id,
          variantId: level.variantId,
          locationId: level.locationId,
          onHand: level.onHand,
          reserved: level.reserved,
          updatedAt: level.updatedAt,
          threshold: thresholdByKey.get(key) ?? null
        };
      });

      for (const threshold of thresholds) {
        const key = `${threshold.variantId}:${threshold.locationId}`;
        if (levelByKey.has(key)) {
          continue;
        }

        items.push({
          id: null,
          variantId: threshold.variantId,
          locationId: threshold.locationId,
          onHand: 0,
          reserved: 0,
          updatedAt: null,
          threshold: threshold.threshold
        });
      }

      return {
        items
      };
    },

    async setThreshold(storeId: string, input: SetThresholdInput) {
      await db.$transaction(async (tx: Tx) => {
        await ensureVariantExists(tx, storeId, input.variantId);
        await ensureLocationExists(tx, storeId, input.locationId);
      });

      const threshold = await db.lowStockThreshold.upsert({
        where: {
          storeId_variantId_locationId: {
            storeId,
            variantId: input.variantId,
            locationId: input.locationId
          }
        },
        create: {
          storeId,
          variantId: input.variantId,
          locationId: input.locationId,
          threshold: input.threshold
        },
        update: {
          threshold: input.threshold
        }
      });

      return {
        id: threshold.id,
        variantId: threshold.variantId,
        locationId: threshold.locationId,
        threshold: threshold.threshold
      };
    },

    async adjustInventory(storeId: string, input: AdjustInventoryInput, createdByAdminUserId?: string) {
      const txResult = await db.$transaction(async (tx: Tx) => {
        await ensureVariantExists(tx, storeId, input.variantId);
        await ensureLocationExists(tx, storeId, input.locationId);

        const existingLevel = await tx.inventoryLevel.findUnique({
          where: {
            storeId_variantId_locationId: {
              storeId,
              variantId: input.variantId,
              locationId: input.locationId
            }
          }
        });

        const previousOnHand = existingLevel?.onHand ?? 0;
        const nextOnHand = previousOnHand + input.delta;

        if (nextOnHand < 0) {
          throw badRequest("Inventory cannot go below 0", "INSUFFICIENT_INVENTORY");
        }

        const movement = await tx.inventoryMovement.create({
          data: {
            storeId,
            variantId: input.variantId,
            locationId: input.locationId,
            delta: input.delta,
            reason: "ADJUSTMENT",
            note: input.note,
            createdByAdminUserId
          }
        });

        const level = await tx.inventoryLevel.upsert({
          where: {
            storeId_variantId_locationId: {
              storeId,
              variantId: input.variantId,
              locationId: input.locationId
            }
          },
          create: {
            storeId,
            variantId: input.variantId,
            locationId: input.locationId,
            onHand: nextOnHand,
            reserved: existingLevel?.reserved ?? 0
          },
          update: {
            onHand: nextOnHand
          }
        });

        const threshold = await tx.lowStockThreshold.findUnique({
          where: {
            storeId_variantId_locationId: {
              storeId,
              variantId: input.variantId,
              locationId: input.locationId
            }
          }
        });

        const crossedLowStockBoundary =
          !!threshold && previousOnHand > threshold.threshold && nextOnHand <= threshold.threshold;

        return {
          movementId: movement.id,
          level,
          lowStockEvent:
            crossedLowStockBoundary && threshold
              ? {
                  storeId,
                  variantId: input.variantId,
                  locationId: input.locationId,
                  onHand: nextOnHand,
                  threshold: threshold.threshold
                }
              : null
        };
      });

      if (txResult.lowStockEvent) {
        const payload: InventoryLowEventPayload = txResult.lowStockEvent;

        await eventsQueue.add(EVENT_JOB_INVENTORY_LOW, payload, {
          jobId: `${LOW_STOCK_EVENT_JOB_PREFIX}:${storeId}:${input.variantId}:${input.locationId}:${txResult.movementId}`,
          removeOnComplete: 1000,
          removeOnFail: 1000
        });
      }

      return {
        id: txResult.level.id,
        variantId: txResult.level.variantId,
        locationId: txResult.level.locationId,
        onHand: txResult.level.onHand,
        reserved: txResult.level.reserved,
        updatedAt: txResult.level.updatedAt
      };
    },

    async listMovements(
      storeId: string,
      input: {
        variantId?: string;
        locationId?: string;
        page?: number;
        limit?: number;
      }
    ) {
      const page = Math.max(1, input.page ?? 1);
      const limit = Math.min(200, Math.max(1, input.limit ?? 50));
      const skip = (page - 1) * limit;

      const where: any = {
        storeId,
        ...(input.variantId ? { variantId: input.variantId } : {}),
        ...(input.locationId ? { locationId: input.locationId } : {})
      };

      const [items, total] = await Promise.all([
        db.inventoryMovement.findMany({
          where,
          skip,
          take: limit,
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          include: {
            variant: {
              select: {
                id: true,
                productId: true,
                title: true,
                sku: true
              }
            },
            location: {
              select: {
                id: true,
                name: true,
                code: true
              }
            }
          }
        }),
        db.inventoryMovement.count({ where })
      ]);

      return {
        items: items.map((movement: any) => ({
          id: movement.id,
          variantId: movement.variantId,
          productId: movement.variant.productId,
          variantTitle: movement.variant.title,
          variantSku: movement.variant.sku,
          locationId: movement.locationId,
          locationName: movement.location.name,
          locationCode: movement.location.code,
          delta: movement.delta,
          reason: movement.reason,
          note: movement.note,
          createdAt: movement.createdAt,
          createdByAdminUserId: movement.createdByAdminUserId
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.max(1, Math.ceil(total / limit))
        }
      };
    }
  };
}
