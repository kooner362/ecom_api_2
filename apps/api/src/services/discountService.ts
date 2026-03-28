import { prisma } from "@ecom/db";
import { badRequest } from "../lib/errors.js";

const db = prisma as any;

export type DiscountType = "PERCENT" | "FIXED";

export interface CartLineInput {
  lineId?: string;
  categoryIds: string[];
  subtotalCents: number;
}

export interface CategoryDiscountBreakdownLine {
  lineId?: string;
  lineIndex: number;
  categoryId: string | null;
  categoryDiscountId: string | null;
  lineSubtotalCents: number;
  discountCents: number;
}

export interface CategoryDiscountResult {
  discountCents: number;
  breakdown: CategoryDiscountBreakdownLine[];
}

export interface CouponDiscountResult {
  valid: boolean;
  discountCents: number;
  reason?: string;
  coupon?: {
    id: string;
    code: string;
    type: DiscountType;
    percentBps: number | null;
    amountCents: number | null;
    minSubtotalCents: number;
    maxRedemptions: number | null;
    maxRedemptionsPerCustomer: number | null;
    expiresAt: Date | null;
  };
}

export interface BestDiscountResult {
  applied: "COUPON" | "CATEGORY" | "NONE";
  discountCents: number;
  details: {
    coupon?: CouponDiscountResult;
    category?: CategoryDiscountResult;
  };
}

interface DiscountValue {
  type: DiscountType;
  percentBps: number | null;
  amountCents: number | null;
}

function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}

function computeDiscountCents(input: DiscountValue, subtotalCents: number): number {
  const base = Math.max(0, subtotalCents);

  if (input.type === "PERCENT") {
    if (!Number.isInteger(input.percentBps) || (input.percentBps as number) < 0) {
      return 0;
    }
    return Math.min(base, Math.round((base * (input.percentBps as number)) / 10000));
  }

  if (!Number.isInteger(input.amountCents) || (input.amountCents as number) < 0) {
    return 0;
  }

  return Math.min(base, input.amountCents as number);
}

function validateDiscountInput(type: DiscountType, percentBps?: number | null, amountCents?: number | null) {
  if (type === "PERCENT") {
    if (!Number.isInteger(percentBps) || (percentBps as number) < 0) {
      throw badRequest("percentBps is required for PERCENT discounts", "INVALID_DISCOUNT_CONFIG");
    }
    return;
  }

  if (!Number.isInteger(amountCents) || (amountCents as number) < 0) {
    throw badRequest("amountCents is required for FIXED discounts", "INVALID_DISCOUNT_CONFIG");
  }
}

function nowInRange(now: Date, startsAt?: Date | null, endsAt?: Date | null) {
  if (startsAt && startsAt > now) {
    return false;
  }

  if (endsAt && endsAt < now) {
    return false;
  }

  return true;
}

async function getCouponUsageCounts(client: any, storeId: string, couponId: string, customerId?: string) {
  const globalUsagePromise = client.couponRedemption.count({
    where: {
      storeId,
      couponId
    }
  });

  const customerUsagePromise = customerId
    ? client.couponRedemption.count({
        where: {
          storeId,
          couponId,
          customerId
        }
      })
    : Promise.resolve(0);

  const [globalUsageCount, customerUsageCount] = await Promise.all([globalUsagePromise, customerUsagePromise]);

  return { globalUsageCount, customerUsageCount };
}

export const discountService = {
  normalizeCouponCode(code: string) {
    return normalizeCode(code);
  },

  async computeCategoryDiscount(storeId: string, cartLines: CartLineInput[]): Promise<CategoryDiscountResult> {
    return this.computeCategoryDiscountWithClient(db, storeId, cartLines);
  },

  async computeCategoryDiscountWithClient(client: any, storeId: string, cartLines: CartLineInput[]): Promise<CategoryDiscountResult> {
    if (!cartLines.length) {
      return { discountCents: 0, breakdown: [] };
    }

    const categoryIds = Array.from(
      new Set(
        cartLines
          .flatMap((line) => line.categoryIds)
          .map((id) => id.trim())
          .filter((id) => id.length > 0)
      )
    );

    if (!categoryIds.length) {
      return {
        discountCents: 0,
        breakdown: cartLines.map((line, index) => ({
          lineId: line.lineId,
          lineIndex: index,
          categoryId: null,
          categoryDiscountId: null,
          lineSubtotalCents: Math.max(0, line.subtotalCents),
          discountCents: 0
        }))
      };
    }

    const now = new Date();
    const discounts = await client.categoryDiscount.findMany({
      where: {
        storeId,
        enabled: true,
        categoryId: { in: categoryIds },
        OR: [{ startsAt: null }, { startsAt: { lte: now } }],
        AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }]
      },
      select: {
        id: true,
        categoryId: true,
        type: true,
        percentBps: true,
        amountCents: true,
        startsAt: true,
        endsAt: true
      }
    });

    const discountsByCategory = new Map<string, any[]>();
    for (const discount of discounts) {
      const list = discountsByCategory.get(discount.categoryId) ?? [];
      list.push(discount);
      discountsByCategory.set(discount.categoryId, list);
    }

    const breakdown: CategoryDiscountBreakdownLine[] = [];
    let total = 0;

    for (let index = 0; index < cartLines.length; index += 1) {
      const line = cartLines[index];
      const lineSubtotalCents = Math.max(0, line.subtotalCents);
      let bestForLine = {
        discountCents: 0,
        categoryId: null as string | null,
        categoryDiscountId: null as string | null
      };

      for (const categoryId of line.categoryIds) {
        const categoryDiscounts = discountsByCategory.get(categoryId) ?? [];

        for (const discount of categoryDiscounts) {
          if (!nowInRange(now, discount.startsAt, discount.endsAt)) {
            continue;
          }

          const discountCents = computeDiscountCents(
            {
              type: discount.type,
              percentBps: discount.percentBps,
              amountCents: discount.amountCents
            },
            lineSubtotalCents
          );

          if (discountCents > bestForLine.discountCents) {
            bestForLine = {
              discountCents,
              categoryId,
              categoryDiscountId: discount.id
            };
          }
        }
      }

      total += bestForLine.discountCents;
      breakdown.push({
        lineId: line.lineId,
        lineIndex: index,
        categoryId: bestForLine.categoryId,
        categoryDiscountId: bestForLine.categoryDiscountId,
        lineSubtotalCents,
        discountCents: bestForLine.discountCents
      });
    }

    return {
      discountCents: total,
      breakdown
    };
  },

  async computeCouponDiscount(
    storeId: string,
    code: string,
    customerId: string | undefined,
    subtotalCents: number
  ): Promise<CouponDiscountResult> {
    return this.computeCouponDiscountWithClient(db, storeId, code, customerId, subtotalCents);
  },

  async computeCouponDiscountWithClient(
    client: any,
    storeId: string,
    code: string,
    customerId: string | undefined,
    subtotalCents: number
  ): Promise<CouponDiscountResult> {
    const normalizedCode = normalizeCode(code);
    if (!normalizedCode) {
      return {
        valid: false,
        discountCents: 0,
        reason: "CODE_REQUIRED"
      };
    }

    const coupon = await client.coupon.findFirst({
      where: {
        storeId,
        code: normalizedCode
      }
    });

    if (!coupon) {
      return {
        valid: false,
        discountCents: 0,
        reason: "COUPON_NOT_FOUND"
      };
    }

    if (!coupon.enabled) {
      return {
        valid: false,
        discountCents: 0,
        reason: "COUPON_DISABLED"
      };
    }

    const now = new Date();
    if (coupon.expiresAt && coupon.expiresAt < now) {
      return {
        valid: false,
        discountCents: 0,
        reason: "COUPON_EXPIRED"
      };
    }

    const baseSubtotal = Math.max(0, subtotalCents);
    if (baseSubtotal < coupon.minSubtotalCents) {
      return {
        valid: false,
        discountCents: 0,
        reason: "MIN_SUBTOTAL_NOT_MET",
        coupon: {
          id: coupon.id,
          code: coupon.code,
          type: coupon.type,
          percentBps: coupon.percentBps,
          amountCents: coupon.amountCents,
          minSubtotalCents: coupon.minSubtotalCents,
          maxRedemptions: coupon.maxRedemptions,
          maxRedemptionsPerCustomer: coupon.maxRedemptionsPerCustomer,
          expiresAt: coupon.expiresAt
        }
      };
    }

    const { globalUsageCount, customerUsageCount } = await getCouponUsageCounts(client, storeId, coupon.id, customerId);

    if (coupon.maxRedemptions !== null && globalUsageCount >= coupon.maxRedemptions) {
      return {
        valid: false,
        discountCents: 0,
        reason: "MAX_REDEMPTIONS_REACHED"
      };
    }

    if (coupon.maxRedemptionsPerCustomer !== null) {
      if (!customerId) {
        return {
          valid: false,
          discountCents: 0,
          reason: "CUSTOMER_REQUIRED"
        };
      }

      if (customerUsageCount >= coupon.maxRedemptionsPerCustomer) {
        return {
          valid: false,
          discountCents: 0,
          reason: "MAX_REDEMPTIONS_PER_CUSTOMER_REACHED"
        };
      }
    }

    const discountCents = computeDiscountCents(
      {
        type: coupon.type,
        percentBps: coupon.percentBps,
        amountCents: coupon.amountCents
      },
      baseSubtotal
    );

    return {
      valid: true,
      discountCents,
      coupon: {
        id: coupon.id,
        code: coupon.code,
        type: coupon.type,
        percentBps: coupon.percentBps,
        amountCents: coupon.amountCents,
        minSubtotalCents: coupon.minSubtotalCents,
        maxRedemptions: coupon.maxRedemptions,
        maxRedemptionsPerCustomer: coupon.maxRedemptionsPerCustomer,
        expiresAt: coupon.expiresAt
      }
    };
  },

  async computeBestDiscount(
    storeId: string,
    cartLines: CartLineInput[],
    code?: string,
    customerId?: string
  ): Promise<BestDiscountResult> {
    return this.computeBestDiscountWithClient(db, storeId, cartLines, code, customerId);
  },

  async computeBestDiscountWithClient(
    client: any,
    storeId: string,
    cartLines: CartLineInput[],
    code?: string,
    customerId?: string
  ): Promise<BestDiscountResult> {
    const category = await this.computeCategoryDiscountWithClient(client, storeId, cartLines);

    const subtotalCents = cartLines.reduce((sum, line) => sum + Math.max(0, line.subtotalCents), 0);
    const coupon = code
      ? await this.computeCouponDiscountWithClient(client, storeId, code, customerId, subtotalCents)
      : ({ valid: false, discountCents: 0, reason: "NO_COUPON_CODE" } as CouponDiscountResult);

    if (coupon.valid && coupon.discountCents > category.discountCents) {
      return {
        applied: "COUPON",
        discountCents: coupon.discountCents,
        details: {
          coupon,
          category
        }
      };
    }

    if (coupon.valid && coupon.discountCents === category.discountCents && coupon.discountCents > 0) {
      // Deterministic no-stacking tie-breaker: coupon wins when discount amounts are equal.
      return {
        applied: "COUPON",
        discountCents: coupon.discountCents,
        details: {
          coupon,
          category
        }
      };
    }

    if (category.discountCents > 0) {
      return {
        applied: "CATEGORY",
        discountCents: category.discountCents,
        details: {
          coupon,
          category
        }
      };
    }

    return {
      applied: "NONE",
      discountCents: 0,
      details: {
        coupon,
        category
      }
    };
  },

  validateDiscountConfig(type: DiscountType, percentBps?: number | null, amountCents?: number | null) {
    validateDiscountInput(type, percentBps, amountCents);
  }
};
