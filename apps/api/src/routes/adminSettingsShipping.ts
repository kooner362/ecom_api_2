import { Router } from "express";
import { z } from "zod";
import type { ApiEnv } from "@ecom/shared";
import { badRequest } from "../lib/errors.js";
import { createAuthMiddleware } from "../middleware/auth.js";
import { shippingService, type ShippingMethodType } from "../services/shippingService.js";

const shippingMethodTypeSchema = z.enum(["FLAT_RATE", "LOCAL_DELIVERY", "PICKUP"]);

const typeParamSchema = z.object({
  type: shippingMethodTypeSchema
});

const shippingMethodUpdateSchema = z
  .object({
    enabled: z.boolean().optional(),
    name: z.string().min(1).max(120).optional(),
    configJson: z.record(z.unknown()).optional()
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided"
  });

export function createAdminSettingsShippingRouter(env: ApiEnv, storeId: string) {
  const router = Router();

  router.use("/admin", createAuthMiddleware(env, "ADMIN"));

  router.get("/admin/settings/shipping-methods", async (_req, res, next) => {
    try {
      const methods = await shippingService.listShippingMethods(storeId);
      res.json(methods);
    } catch (error) {
      next(error);
    }
  });

  router.patch("/admin/settings/shipping-methods/:type", async (req, res, next) => {
    try {
      const params = typeParamSchema.safeParse(req.params);
      if (!params.success) {
        next(badRequest("Invalid shipping method type", "INVALID_REQUEST"));
        return;
      }

      const parsed = shippingMethodUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        next(badRequest("Invalid request body", "INVALID_REQUEST"));
        return;
      }

      const method = await shippingService.updateShippingMethod(
        storeId,
        params.data.type as ShippingMethodType,
        parsed.data
      );

      res.json(method);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
