import { Router } from "express";
import { z } from "zod";
import type { ApiEnv } from "@ecom/shared";
import { badRequest } from "../lib/errors.js";
import { shippingService } from "../services/shippingService.js";
import { taxService } from "../services/taxService.js";
import { createAuthMiddleware } from "../middleware/auth.js";

const shippingMethodsQuerySchema = z.object({
  postalCode: z.string().optional(),
  province: z.string().optional(),
  country: z.string().optional()
});

const taxPreviewSchema = z.object({
  shippingAddress: z.object({
    country: z.string().optional(),
    province: z.string().optional(),
    postalCode: z.string().optional()
  }),
  subtotalCents: z.coerce.number().int().nonnegative(),
  shippingCents: z.coerce.number().int().nonnegative(),
  discountCents: z.coerce.number().int().nonnegative()
});

export function createStoreCheckoutConfigRouter(env: ApiEnv, storeId: string) {
  const router = Router();
  router.use("/store", createAuthMiddleware(env, "CUSTOMER"));

  router.get("/store/checkout/shipping-methods", async (req, res, next) => {
    try {
      const parsed = shippingMethodsQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        next(badRequest("Invalid query parameters", "INVALID_REQUEST"));
        return;
      }

      const methods = await shippingService.getEnabledShippingMethods(storeId, parsed.data);
      res.json(methods);
    } catch (error) {
      next(error);
    }
  });

  router.post("/store/checkout/tax-preview", async (req, res, next) => {
    try {
      const parsed = taxPreviewSchema.safeParse(req.body);
      if (!parsed.success) {
        next(badRequest("Invalid request body", "INVALID_REQUEST"));
        return;
      }

      const taxableBaseCents = parsed.data.subtotalCents - parsed.data.discountCents + parsed.data.shippingCents;
      const taxPreview = await taxService.computeTax(storeId, parsed.data.shippingAddress, taxableBaseCents);

      res.json(taxPreview);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
