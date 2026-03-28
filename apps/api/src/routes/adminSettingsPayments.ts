import { Router } from "express";
import { z } from "zod";
import type { ApiEnv } from "@ecom/shared";
import { badRequest } from "../lib/errors.js";
import { createAuthMiddleware } from "../middleware/auth.js";
import { paymentSettingsService, PROVIDERS } from "../services/paymentSettingsService.js";

const providerSchema = z.enum(PROVIDERS);
const providerParamSchema = z.object({
  provider: providerSchema
});

const updateSchema = z
  .object({
    enabled: z.boolean().optional(),
    publicKey: z.string().max(500).optional(),
    secretKey: z.string().max(500).optional(),
    testMode: z.boolean().optional(),
    manualPaymentEmail: z.string().email().max(320).nullable().optional()
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided"
  });

export function createAdminSettingsPaymentsRouter(env: ApiEnv, storeId: string) {
  const router = Router();
  router.use("/admin", createAuthMiddleware(env, "ADMIN"));

  router.get("/admin/settings/payments", async (_req, res, next) => {
    try {
      const items = await paymentSettingsService.list(storeId, env);
      res.json({ items });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/admin/settings/payments/:provider", async (req, res, next) => {
    try {
      const params = providerParamSchema.safeParse(req.params);
      if (!params.success) {
        next(badRequest("Invalid provider", "INVALID_REQUEST"));
        return;
      }

      const parsed = updateSchema.safeParse(req.body);
      if (!parsed.success) {
        next(badRequest("Invalid request body", "INVALID_REQUEST"));
        return;
      }

      const provider = await paymentSettingsService.update(storeId, env, params.data.provider, parsed.data);
      res.json(provider);
    } catch (error) {
      next(error);
    }
  });

  router.post("/admin/settings/payments/:provider/activate", async (req, res, next) => {
    try {
      const params = providerParamSchema.safeParse(req.params);
      if (!params.success) {
        next(badRequest("Invalid provider", "INVALID_REQUEST"));
        return;
      }

      const provider = await paymentSettingsService.activate(storeId, env, params.data.provider);
      res.json(provider);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
