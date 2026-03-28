import { Router } from "express";
import { z } from "zod";
import type { ApiEnv } from "@ecom/shared";
import { badRequest } from "../lib/errors.js";
import { createAuthMiddleware } from "../middleware/auth.js";
import { orderService } from "../services/orderService.js";

const idParamSchema = z.object({
  id: z.string().min(1)
});

const refundSchema = z.object({
  amountCents: z.coerce.number().int().positive(),
  reason: z.string().max(500).optional()
});

const returnsSchema = z.object({
  items: z.array(
    z.object({
      orderItemId: z.string().min(1),
      quantityReturned: z.coerce.number().int().positive().optional()
    })
  ).min(1)
});

export function createAdminRefundsReturnsRouter(env: ApiEnv, storeId: string) {
  const router = Router();
  router.use("/admin", createAuthMiddleware(env, "ADMIN"));

  router.post("/admin/orders/:id/refunds", async (req, res, next) => {
    try {
      const params = idParamSchema.safeParse(req.params);
      if (!params.success) {
        next(badRequest("Invalid order id", "INVALID_REQUEST"));
        return;
      }

      const parsed = refundSchema.safeParse(req.body);
      if (!parsed.success) {
        next(badRequest("Invalid request body", "INVALID_REQUEST"));
        return;
      }

      const order = await orderService.createRefund(
        env,
        storeId,
        params.data.id,
        parsed.data.amountCents,
        parsed.data.reason,
        req.auth?.userId
      );

      res.json(order);
    } catch (error) {
      next(error);
    }
  });

  router.post("/admin/orders/:id/returns", async (req, res, next) => {
    try {
      const params = idParamSchema.safeParse(req.params);
      if (!params.success) {
        next(badRequest("Invalid order id", "INVALID_REQUEST"));
        return;
      }

      const parsed = returnsSchema.safeParse(req.body);
      if (!parsed.success) {
        next(badRequest("Invalid request body", "INVALID_REQUEST"));
        return;
      }

      const itemIds = Array.from(new Set(parsed.data.items.map((item) => item.orderItemId)));
      const order = await orderService.markItemsReturned(storeId, params.data.id, itemIds, req.auth?.userId);
      res.json(order);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
