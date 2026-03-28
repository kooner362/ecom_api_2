import { join, sqltag } from "@prisma/client/runtime/library";
import { badRequest } from "../lib/errors.js";

type Tx = any;

export interface AllocationRequest {
  variantId: string;
  quantity: number;
  orderItemId: string;
}

export interface AllocationResult {
  orderItemId: string;
  variantId: string;
  locationId: string;
  quantity: number;
}

function ensurePositiveInt(value: number, field: string) {
  if (!Number.isInteger(value) || value <= 0) {
    throw badRequest(`${field} must be a positive integer`, "INVALID_REQUEST");
  }
}

export const inventoryAllocationService = {
  async allocateSingleBestLocation(tx: Tx, storeId: string, requests: AllocationRequest[]): Promise<AllocationResult[]> {
    if (!requests.length) {
      return [];
    }

    for (const request of requests) {
      ensurePositiveInt(request.quantity, "quantity");
    }

    const variantIds = Array.from(new Set(requests.map((item) => item.variantId)));

    await tx.$queryRaw(
      sqltag`
        SELECT il."id"
        FROM "InventoryLevel" il
        INNER JOIN "Location" l ON l."id" = il."locationId"
        WHERE il."storeId" = ${storeId}
          AND il."variantId" IN (${join(variantIds)})
          AND l."isActive" = true
        FOR UPDATE
      `
    );

    const levels = await tx.inventoryLevel.findMany({
      where: {
        storeId,
        variantId: { in: variantIds },
        location: { isActive: true }
      },
      include: {
        location: {
          select: { id: true, isActive: true }
        }
      }
    });

    const levelsByVariant = new Map<string, any[]>();
    for (const level of levels) {
      const list = levelsByVariant.get(level.variantId) ?? [];
      list.push(level);
      levelsByVariant.set(level.variantId, list);
    }

    const allocations: AllocationResult[] = [];

    for (const request of requests) {
      const candidates = (levelsByVariant.get(request.variantId) ?? [])
        .filter((level) => level.onHand >= request.quantity)
        .sort((a, b) => b.onHand - a.onHand);

      const best = candidates[0];
      if (!best) {
        throw badRequest(`Insufficient inventory for variant ${request.variantId}`, "INSUFFICIENT_INVENTORY");
      }

      await tx.inventoryLevel.update({
        where: { id: best.id },
        data: {
          onHand: {
            decrement: request.quantity
          }
        }
      });

      allocations.push({
        orderItemId: request.orderItemId,
        variantId: request.variantId,
        locationId: best.locationId,
        quantity: request.quantity
      });
    }

    if (allocations.length > 0) {
      await tx.inventoryAllocation.createMany({
        data: allocations.map((item) => ({
          storeId,
          orderItemId: item.orderItemId,
          locationId: item.locationId,
          quantity: item.quantity
        }))
      });

      await tx.inventoryMovement.createMany({
        data: allocations.map((item) => ({
          storeId,
          variantId: item.variantId,
          locationId: item.locationId,
          delta: -item.quantity,
          reason: "SALE",
          note: `Allocated for order item ${item.orderItemId}`
        }))
      });
    }

    return allocations;
  }
};
