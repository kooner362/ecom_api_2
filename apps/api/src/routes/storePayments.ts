import { Router } from "express";
import type { ApiEnv } from "@ecom/shared";
import { paymentSettingsService } from "../services/paymentSettingsService.js";

export function createStorePaymentsRouter(env: ApiEnv, storeId: string) {
  const router = Router();

  router.get("/store/payments", async (_req, res, next) => {
    try {
      const items = await paymentSettingsService.listPublic(storeId, env);
      res.json({ items });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
