import { Router } from "express";
import { z } from "zod";
import type { ApiEnv } from "@ecom/shared";
import { badRequest, unauthorized } from "../lib/errors.js";
import { discountService } from "../services/discountService.js";
import { createAuthMiddleware } from "../middleware/auth.js";

const validateCouponSchema = z.object({
  code: z.string().min(1),
  customerId: z.string().min(1).optional(),
  subtotalCents: z.coerce.number().int().nonnegative().optional()
});

export function createStoreCouponsRouter(env: ApiEnv, storeId: string) {
  const router = Router();
  router.use("/store", createAuthMiddleware(env, "CUSTOMER"));

  router.post("/store/checkout/validate-coupon", async (req, res, next) => {
    try {
      if (!req.auth) {
        next(unauthorized());
        return;
      }

      const parsed = validateCouponSchema.safeParse(req.body);
      if (!parsed.success) {
        next(badRequest("Invalid request body", "INVALID_REQUEST"));
        return;
      }

      const result = await discountService.computeCouponDiscount(
        storeId,
        parsed.data.code,
        parsed.data.customerId ?? req.auth.userId,
        parsed.data.subtotalCents ?? 0
      );

      res.json({
        valid: result.valid,
        reason: result.reason,
        coupon: result.coupon,
        estimatedDiscountCents: result.discountCents
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
