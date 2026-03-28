import { Router } from "express";
import { z } from "zod";
import { Queue } from "bullmq";
import type { ApiEnv } from "@ecom/shared";
import { badRequest, unauthorized } from "../lib/errors.js";
import { createAuthMiddleware } from "../middleware/auth.js";
import { createCheckoutService } from "../services/checkoutService.js";

const addItemSchema = z.object({
  variantId: z.string().min(1),
  quantity: z.coerce.number().int().positive()
});

const updateItemSchema = z.object({
  quantity: z.coerce.number().int().positive()
});

const idParamSchema = z.object({
  id: z.string().min(1)
});

export function createStoreCartRouter(eventsQueue: Queue, env: ApiEnv, storeId: string) {
  const router = Router();
  const checkoutService = createCheckoutService(eventsQueue, env);

  router.use("/store", createAuthMiddleware(env, "CUSTOMER"));

  router.get("/store/cart", async (req, res, next) => {
    try {
      if (!req.auth) {
        next(unauthorized());
        return;
      }

      const cart = await checkoutService.getOrCreateActiveCart(storeId, req.auth.userId);
      res.json(cart);
    } catch (error) {
      next(error);
    }
  });

  router.post("/store/cart/items", async (req, res, next) => {
    try {
      if (!req.auth) {
        next(unauthorized());
        return;
      }

      const parsed = addItemSchema.safeParse(req.body);
      if (!parsed.success) {
        next(badRequest("Invalid request body", "INVALID_REQUEST"));
        return;
      }

      const cart = await checkoutService.addCartItem(
        storeId,
        req.auth.userId,
        parsed.data.variantId,
        parsed.data.quantity
      );

      res.json(cart);
    } catch (error) {
      next(error);
    }
  });

  router.patch("/store/cart/items/:id", async (req, res, next) => {
    try {
      if (!req.auth) {
        next(unauthorized());
        return;
      }

      const params = idParamSchema.safeParse(req.params);
      if (!params.success) {
        next(badRequest("Invalid cart item id", "INVALID_REQUEST"));
        return;
      }

      const parsed = updateItemSchema.safeParse(req.body);
      if (!parsed.success) {
        next(badRequest("Invalid request body", "INVALID_REQUEST"));
        return;
      }

      const cart = await checkoutService.updateCartItemQuantity(
        storeId,
        req.auth.userId,
        params.data.id,
        parsed.data.quantity
      );

      res.json(cart);
    } catch (error) {
      next(error);
    }
  });

  router.delete("/store/cart/items/:id", async (req, res, next) => {
    try {
      if (!req.auth) {
        next(unauthorized());
        return;
      }

      const params = idParamSchema.safeParse(req.params);
      if (!params.success) {
        next(badRequest("Invalid cart item id", "INVALID_REQUEST"));
        return;
      }

      const cart = await checkoutService.removeCartItem(storeId, req.auth.userId, params.data.id);
      res.json(cart);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
