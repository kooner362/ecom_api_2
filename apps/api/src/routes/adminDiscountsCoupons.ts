import { Router } from "express";
import { z } from "zod";
import { prisma } from "@ecom/db";
import type { ApiEnv } from "@ecom/shared";
import { badRequest } from "../lib/errors.js";
import { createAuthMiddleware } from "../middleware/auth.js";
import { discountService } from "../services/discountService.js";

const db = prisma as any;

const discountTypeSchema = z.enum(["PERCENT", "FIXED"]);

const couponCreateSchema = z
  .object({
    code: z.string().min(1).max(120),
    enabled: z.boolean().optional(),
    type: discountTypeSchema,
    percentBps: z.coerce.number().int().nonnegative().nullable().optional(),
    amountCents: z.coerce.number().int().nonnegative().nullable().optional(),
    minSubtotalCents: z.coerce.number().int().nonnegative().optional(),
    maxRedemptions: z.coerce.number().int().positive().nullable().optional(),
    maxRedemptionsPerCustomer: z.coerce.number().int().positive().nullable().optional(),
    expiresAt: z.coerce.date().nullable().optional()
  })
  .superRefine((value, ctx) => {
    if (value.type === "PERCENT" && typeof value.percentBps !== "number") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["percentBps"],
        message: "percentBps is required for PERCENT discounts"
      });
    }

    if (value.type === "FIXED" && typeof value.amountCents !== "number") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["amountCents"],
        message: "amountCents is required for FIXED discounts"
      });
    }
  });

const couponUpdateSchema = z
  .object({
    code: z.string().min(1).max(120).optional(),
    enabled: z.boolean().optional(),
    type: discountTypeSchema.optional(),
    percentBps: z.coerce.number().int().nonnegative().nullable().optional(),
    amountCents: z.coerce.number().int().nonnegative().nullable().optional(),
    minSubtotalCents: z.coerce.number().int().nonnegative().optional(),
    maxRedemptions: z.coerce.number().int().positive().nullable().optional(),
    maxRedemptionsPerCustomer: z.coerce.number().int().positive().nullable().optional(),
    expiresAt: z.coerce.date().nullable().optional()
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided"
  });

const couponListQuerySchema = z.object({
  q: z.string().optional(),
  enabled: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === "true"))
});

const idParamSchema = z.object({ id: z.string().min(1) });

function mapCoupon(coupon: any) {
  return {
    id: coupon.id,
    code: coupon.code,
    enabled: coupon.enabled,
    type: coupon.type,
    percentBps: coupon.percentBps,
    amountCents: coupon.amountCents,
    minSubtotalCents: coupon.minSubtotalCents,
    maxRedemptions: coupon.maxRedemptions,
    maxRedemptionsPerCustomer: coupon.maxRedemptionsPerCustomer,
    expiresAt: coupon.expiresAt,
    createdAt: coupon.createdAt,
    updatedAt: coupon.updatedAt
  };
}

export function createAdminDiscountsCouponsRouter(env: ApiEnv, storeId: string) {
  const router = Router();
  router.use("/admin", createAuthMiddleware(env, "ADMIN"));

  router.post("/admin/discounts/coupons", async (req, res, next) => {
    try {
      const parsed = couponCreateSchema.safeParse(req.body);
      if (!parsed.success) {
        next(badRequest("Invalid request body", "INVALID_REQUEST"));
        return;
      }

      discountService.validateDiscountConfig(parsed.data.type, parsed.data.percentBps, parsed.data.amountCents);
      const code = discountService.normalizeCouponCode(parsed.data.code);

      const existing = await db.coupon.findFirst({ where: { storeId, code }, select: { id: true } });
      if (existing) {
        next(badRequest("Coupon code already exists", "COUPON_CODE_EXISTS"));
        return;
      }

      const created = await db.coupon.create({
        data: {
          storeId,
          code,
          enabled: parsed.data.enabled ?? true,
          type: parsed.data.type,
          percentBps: parsed.data.type === "PERCENT" ? parsed.data.percentBps : null,
          amountCents: parsed.data.type === "FIXED" ? parsed.data.amountCents : null,
          minSubtotalCents: parsed.data.minSubtotalCents ?? 0,
          maxRedemptions: parsed.data.maxRedemptions ?? null,
          maxRedemptionsPerCustomer: parsed.data.maxRedemptionsPerCustomer ?? null,
          expiresAt: parsed.data.expiresAt
        }
      });

      res.status(201).json(mapCoupon(created));
    } catch (error) {
      next(error);
    }
  });

  router.get("/admin/discounts/coupons", async (req, res, next) => {
    try {
      const parsed = couponListQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        next(badRequest("Invalid query parameters", "INVALID_REQUEST"));
        return;
      }

      const items = await db.coupon.findMany({
        where: {
          storeId,
          ...(parsed.data.enabled === undefined ? {} : { enabled: parsed.data.enabled }),
          ...(parsed.data.q
            ? {
                code: {
                  contains: discountService.normalizeCouponCode(parsed.data.q),
                  mode: "insensitive"
                }
              }
            : {})
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }]
      });

      res.json({ items: items.map(mapCoupon) });
    } catch (error) {
      next(error);
    }
  });

  router.get("/admin/discounts/coupons/:id", async (req, res, next) => {
    try {
      const params = idParamSchema.safeParse(req.params);
      if (!params.success) {
        next(badRequest("Invalid coupon id", "INVALID_REQUEST"));
        return;
      }

      const coupon = await db.coupon.findFirst({ where: { id: params.data.id, storeId } });
      if (!coupon) {
        next(badRequest("Coupon not found", "COUPON_NOT_FOUND"));
        return;
      }

      res.json(mapCoupon(coupon));
    } catch (error) {
      next(error);
    }
  });

  router.patch("/admin/discounts/coupons/:id", async (req, res, next) => {
    try {
      const params = idParamSchema.safeParse(req.params);
      if (!params.success) {
        next(badRequest("Invalid coupon id", "INVALID_REQUEST"));
        return;
      }

      const parsed = couponUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        next(badRequest("Invalid request body", "INVALID_REQUEST"));
        return;
      }

      const existing = await db.coupon.findFirst({ where: { id: params.data.id, storeId } });
      if (!existing) {
        next(badRequest("Coupon not found", "COUPON_NOT_FOUND"));
        return;
      }

      const nextType = parsed.data.type ?? existing.type;
      const nextPercentBps = parsed.data.percentBps === undefined ? existing.percentBps : parsed.data.percentBps;
      const nextAmountCents = parsed.data.amountCents === undefined ? existing.amountCents : parsed.data.amountCents;
      discountService.validateDiscountConfig(nextType, nextPercentBps, nextAmountCents);

      const nextCode = parsed.data.code ? discountService.normalizeCouponCode(parsed.data.code) : existing.code;
      if (nextCode !== existing.code) {
        const duplicate = await db.coupon.findFirst({
          where: { storeId, code: nextCode, id: { not: existing.id } },
          select: { id: true }
        });

        if (duplicate) {
          next(badRequest("Coupon code already exists", "COUPON_CODE_EXISTS"));
          return;
        }
      }

      const updated = await db.coupon.update({
        where: { id: existing.id },
        data: {
          code: nextCode,
          enabled: parsed.data.enabled ?? existing.enabled,
          type: nextType,
          percentBps: nextType === "PERCENT" ? nextPercentBps : null,
          amountCents: nextType === "FIXED" ? nextAmountCents : null,
          minSubtotalCents: parsed.data.minSubtotalCents ?? existing.minSubtotalCents,
          maxRedemptions: parsed.data.maxRedemptions === undefined ? existing.maxRedemptions : parsed.data.maxRedemptions,
          maxRedemptionsPerCustomer:
            parsed.data.maxRedemptionsPerCustomer === undefined
              ? existing.maxRedemptionsPerCustomer
              : parsed.data.maxRedemptionsPerCustomer,
          expiresAt: parsed.data.expiresAt === undefined ? existing.expiresAt : parsed.data.expiresAt
        }
      });

      res.json(mapCoupon(updated));
    } catch (error) {
      next(error);
    }
  });

  router.delete("/admin/discounts/coupons/:id", async (req, res, next) => {
    try {
      const params = idParamSchema.safeParse(req.params);
      if (!params.success) {
        next(badRequest("Invalid coupon id", "INVALID_REQUEST"));
        return;
      }

      const existing = await db.coupon.findFirst({ where: { id: params.data.id, storeId }, select: { id: true } });
      if (!existing) {
        next(badRequest("Coupon not found", "COUPON_NOT_FOUND"));
        return;
      }

      await db.coupon.delete({ where: { id: existing.id } });
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
