import { Router } from "express";
import type { ApiEnv } from "@ecom/shared";
import { z } from "zod";
import { badRequest, unauthorized } from "../lib/errors.js";
import { createAuthMiddleware } from "../middleware/auth.js";
import { orderService } from "../services/orderService.js";

const idParamSchema = z.object({
  id: z.string().min(1)
});

export function createStoreOrdersRouter(env: ApiEnv, storeId: string) {
  const router = Router();

  router.use("/store", createAuthMiddleware(env, "CUSTOMER"));

  router.get("/store/orders", async (req, res, next) => {
    try {
      if (!req.auth) {
        next(unauthorized());
        return;
      }

      const orders = await orderService.getCustomerOrders(storeId, req.auth.userId);
      res.json(orders);
    } catch (error) {
      next(error);
    }
  });

  router.get("/store/orders/:id", async (req, res, next) => {
    try {
      if (!req.auth) {
        next(unauthorized());
        return;
      }

      const params = idParamSchema.safeParse(req.params);
      if (!params.success) {
        next(badRequest("Invalid order id", "INVALID_REQUEST"));
        return;
      }

      const order = await orderService.getCustomerOrderById(storeId, req.auth.userId, params.data.id);
      res.json(order);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
