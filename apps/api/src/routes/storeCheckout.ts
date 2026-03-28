import { Router } from "express";
import { z } from "zod";
import { Queue } from "bullmq";
import type { ApiEnv } from "@ecom/shared";
import { badRequest, unauthorized } from "../lib/errors.js";
import { createAuthMiddleware } from "../middleware/auth.js";
import { createCheckoutService } from "../services/checkoutService.js";

const shippingMethodTypeSchema = z.enum(["FLAT_RATE", "LOCAL_DELIVERY", "PICKUP"]);

const previewSchema = z.object({
  shippingMethodType: shippingMethodTypeSchema,
  shippingAddressId: z.string().min(1).optional(),
  couponCode: z.string().min(1).optional()
});

const confirmSchema = previewSchema.extend({
  paymentIntentId: z.string().min(1)
});

export function createStoreCheckoutRouter(eventsQueue: Queue, env: ApiEnv, storeId: string) {
  const router = Router();
  const checkoutService = createCheckoutService(eventsQueue, env);

  router.use("/store", createAuthMiddleware(env, "CUSTOMER"));

  router.post("/store/checkout/preview", async (req, res, next) => {
    try {
      if (!req.auth) {
        next(unauthorized());
        return;
      }

      const parsed = previewSchema.safeParse(req.body);
      if (!parsed.success) {
        next(badRequest("Invalid request body", "INVALID_REQUEST"));
        return;
      }

      const preview = await checkoutService.preview(storeId, req.auth.userId, parsed.data);
      res.json(preview);
    } catch (error) {
      next(error);
    }
  });

  router.post("/store/checkout/create-payment-intent", async (req, res, next) => {
    try {
      if (!req.auth) {
        next(unauthorized());
        return;
      }

      const parsed = previewSchema.safeParse(req.body);
      if (!parsed.success) {
        next(badRequest("Invalid request body", "INVALID_REQUEST"));
        return;
      }

      const paymentIntent = await checkoutService.createPaymentIntent(storeId, req.auth.userId, parsed.data);
      res.json(paymentIntent);
    } catch (error) {
      next(error);
    }
  });

  router.post("/store/checkout/confirm", async (req, res, next) => {
    try {
      if (!req.auth) {
        next(unauthorized());
        return;
      }

      const parsed = confirmSchema.safeParse(req.body);
      if (!parsed.success) {
        next(badRequest("Invalid request body", "INVALID_REQUEST"));
        return;
      }

      const order = await checkoutService.confirm(storeId, req.auth.userId, parsed.data);
      res.json(order);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
