import { Router } from "express";
import { Queue } from "bullmq";
import { z } from "zod";
import type { ApiEnv } from "@ecom/shared";
import { badRequest } from "../lib/errors.js";
import { createAuthMiddleware } from "../middleware/auth.js";
import { orderService } from "../services/orderService.js";
import { emailTemplateService } from "../services/emailTemplateService.js";
import { createEmailSendService } from "../services/emailSendService.js";

const listQuerySchema = z.object({
  paymentStatus: z
    .enum(["UNPAID", "AUTHORIZED", "PAID", "PARTIALLY_REFUNDED", "REFUNDED", "FAILED", "CANCELED"])
    .optional(),
  fulfillmentStatus: z.enum(["UNFULFILLED", "PICKING", "PACKED", "SHIPPED", "DELIVERED", "CANCELED"]).optional(),
  q: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20)
});

const idParamSchema = z.object({
  id: z.string().min(1)
});

const fulfillmentUpdateSchema = z.object({
  fulfillmentStatus: z.enum(["UNFULFILLED", "PICKING", "PACKED", "SHIPPED", "DELIVERED", "CANCELED"]),
  trackingNumber: z.string().trim().max(120).optional()
});

export function createAdminOrdersRouter(eventsQueue: Queue, env: ApiEnv, storeId: string) {
  const router = Router();
  router.use("/admin", createAuthMiddleware(env, "ADMIN"));
  const emailSendService = createEmailSendService(eventsQueue);

  router.get("/admin/orders", async (req, res, next) => {
    try {
      const parsed = listQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        next(badRequest("Invalid query parameters", "INVALID_REQUEST"));
        return;
      }

      const orders = await orderService.getAdminOrders(storeId, parsed.data);
      res.json(orders);
    } catch (error) {
      next(error);
    }
  });

  router.get("/admin/orders/:id", async (req, res, next) => {
    try {
      const params = idParamSchema.safeParse(req.params);
      if (!params.success) {
        next(badRequest("Invalid order id", "INVALID_REQUEST"));
        return;
      }

      const order = await orderService.getAdminOrderById(storeId, params.data.id);
      res.json(order);
    } catch (error) {
      next(error);
    }
  });

  router.patch("/admin/orders/:id/fulfillment", async (req, res, next) => {
    try {
      const params = idParamSchema.safeParse(req.params);
      if (!params.success) {
        next(badRequest("Invalid order id", "INVALID_REQUEST"));
        return;
      }

      const parsed = fulfillmentUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        next(badRequest("Invalid request body", "INVALID_REQUEST"));
        return;
      }

      const order = await orderService.updateFulfillmentStatus(
        env,
        storeId,
        params.data.id,
        parsed.data.fulfillmentStatus,
        parsed.data.trackingNumber,
        req.auth?.userId
      );

      if (parsed.data.fulfillmentStatus === "SHIPPED" || parsed.data.fulfillmentStatus === "DELIVERED") {
        const routeType =
          parsed.data.fulfillmentStatus === "SHIPPED" ? "SHIPPED_CONFIRMATION" : "DELIVERED_CONFIRMATION";
        const routes = await emailTemplateService.listRoutes(storeId);
        const route = routes.items.find((item: { type: string; enabled: boolean }) => item.type === routeType);

        if (route?.enabled) {
          await emailSendService.enqueueSendEmailJob({
            storeId,
            orderId: params.data.id,
            routeType,
            idempotencyKey: emailSendService.buildOrderPlacedIdempotencyKey(params.data.id, routeType)
          });
        }
      }

      res.json(order);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
