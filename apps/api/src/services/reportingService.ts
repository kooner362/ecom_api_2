import { prisma } from "@ecom/db";

const db = prisma as any;

export interface ReportingRangeInput {
  start: Date;
  end: Date;
}

function toIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function getDayKey(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function isBillableOrder(order: { paymentStatus: string; fulfillmentStatus: string }): boolean {
  return (
    order.paymentStatus !== "FAILED" &&
    order.paymentStatus !== "CANCELED" &&
    order.fulfillmentStatus !== "CANCELED"
  );
}

export const reportingService = {
  async salesSnapshot(storeId: string, range: ReportingRangeInput) {
    const orders = await db.order.findMany({
      where: {
        storeId,
        placedAt: {
          gte: range.start,
          lte: range.end
        }
      },
      select: {
        id: true,
        totalCents: true,
        paymentStatus: true,
        fulfillmentStatus: true,
        placedAt: true,
        items: {
          select: {
            quantity: true
          }
        }
      },
      orderBy: [{ placedAt: "asc" }, { id: "asc" }]
    });

    const filtered = orders.filter(isBillableOrder);

    const dailyMap = new Map<string, { grossSalesCents: number; ordersCount: number; unitsSold: number }>();

    for (const order of filtered) {
      const key = getDayKey(order.placedAt);
      const unitsSold = (order.items || []).reduce((sum: number, item: any) => sum + (item.quantity || 0), 0);

      const current = dailyMap.get(key) || { grossSalesCents: 0, ordersCount: 0, unitsSold: 0 };
      current.grossSalesCents += order.totalCents || 0;
      current.ordersCount += 1;
      current.unitsSold += unitsSold;
      dailyMap.set(key, current);
    }

    const grossSalesCents = filtered.reduce((sum: number, order: any) => sum + (order.totalCents || 0), 0);
    const ordersCount = filtered.length;
    const unitsSold = filtered.reduce(
      (sum: number, order: any) => sum + (order.items || []).reduce((itemSum: number, item: any) => itemSum + (item.quantity || 0), 0),
      0
    );

    return {
      range: {
        start: range.start.toISOString(),
        end: range.end.toISOString()
      },
      summary: {
        grossSalesCents,
        ordersCount,
        avgOrderValueCents: ordersCount > 0 ? Math.round(grossSalesCents / ordersCount) : 0,
        unitsSold
      },
      daily: Array.from(dailyMap.entries())
        .map(([date, value]) => ({ date, ...value }))
        .sort((a, b) => (a.date < b.date ? -1 : 1))
    };
  },

  async salesByProduct(storeId: string, range: ReportingRangeInput, limit: number) {
    const items = await db.orderItem.findMany({
      where: {
        storeId,
        order: {
          placedAt: {
            gte: range.start,
            lte: range.end
          },
          paymentStatus: {
            notIn: ["FAILED", "CANCELED"]
          },
          fulfillmentStatus: {
            not: "CANCELED"
          }
        }
      },
      select: {
        variantId: true,
        titleSnapshot: true,
        skuSnapshot: true,
        unitPriceCents: true,
        quantity: true,
        variant: {
          select: {
            productId: true
          }
        }
      }
    });

    const byVariant = new Map<
      string,
      {
        productId: string;
        variantId: string;
        title: string;
        sku: string | null;
        unitsSold: number;
        revenueCents: number;
      }
    >();

    for (const item of items) {
      const key = item.variantId;
      const current = byVariant.get(key) || {
        productId: item.variant.productId,
        variantId: item.variantId,
        title: item.titleSnapshot || "Product",
        sku: item.skuSnapshot,
        unitsSold: 0,
        revenueCents: 0
      };
      current.unitsSold += item.quantity || 0;
      current.revenueCents += (item.unitPriceCents || 0) * (item.quantity || 0);
      byVariant.set(key, current);
    }

    const sorted = Array.from(byVariant.values())
      .sort((a, b) => {
        if (b.unitsSold !== a.unitsSold) return b.unitsSold - a.unitsSold;
        return b.revenueCents - a.revenueCents;
      })
      .slice(0, limit)
      .map((item) => ({
        ...item,
        avgUnitPriceCents: item.unitsSold > 0 ? Math.round(item.revenueCents / item.unitsSold) : 0
      }));

    return {
      range: {
        start: range.start.toISOString(),
        end: range.end.toISOString()
      },
      items: sorted
    };
  },

  async inventoryOnHandCost(storeId: string, limit: number) {
    const grouped = await db.inventoryLevel.groupBy({
      by: ["variantId"],
      where: { storeId },
      _sum: {
        onHand: true
      }
    });

    const variantIds = grouped.map((item: any) => item.variantId);
    if (variantIds.length === 0) {
      return {
        summary: {
          totalOnHandUnits: 0,
          totalInventoryCostCents: 0
        },
        items: []
      };
    }

    const variants: any[] = await db.productVariant.findMany({
      where: {
        storeId,
        id: { in: variantIds }
      },
      select: {
        id: true,
        sku: true,
        title: true,
        costCents: true,
        productId: true,
        product: {
          select: {
            title: true
          }
        }
      }
    });

    const variantMap = new Map<string, any>(variants.map((variant: any) => [variant.id, variant] as [string, any]));

    const items = grouped
      .map((entry: any) => {
        const variant = variantMap.get(entry.variantId);
        if (!variant) return null;

        const onHandUnits = entry._sum?.onHand || 0;
        const unitCostCents = typeof variant.costCents === "number" ? variant.costCents : 0;
        const extendedCostCents = onHandUnits * unitCostCents;

        return {
          productId: variant.productId,
          variantId: variant.id,
          productTitle: variant.product?.title || variant.title,
          variantTitle: variant.title,
          sku: variant.sku,
          onHandUnits,
          unitCostCents,
          extendedCostCents
        };
      })
      .filter((item: any) => item !== null)
      .sort((a: any, b: any) => b.extendedCostCents - a.extendedCostCents);

    const totalOnHandUnits = items.reduce((sum: number, item: any) => sum + item.onHandUnits, 0);
    const totalInventoryCostCents = items.reduce((sum: number, item: any) => sum + item.extendedCostCents, 0);

    return {
      asOf: toIsoDate(new Date()),
      summary: {
        totalOnHandUnits,
        totalInventoryCostCents
      },
      items: items.slice(0, limit)
    };
  }
};
