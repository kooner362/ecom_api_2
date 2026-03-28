import { Router } from "express";
import { Queue } from "bullmq";
import { z } from "zod";
import type { ApiEnv } from "@ecom/shared";
import { badRequest } from "../lib/errors.js";
import { createAuthMiddleware } from "../middleware/auth.js";
import { emailTemplateService, EMAIL_ROUTE_TYPES } from "../services/emailTemplateService.js";
import { createEmailSendService } from "../services/emailSendService.js";

const paramsSchema = z.object({
  id: z.string().min(1),
  type: z.enum(EMAIL_ROUTE_TYPES)
});

const querySchema = z.object({
  force: z.union([z.literal("1"), z.literal("true")]).optional()
});

export function createAdminOrderEmailsRouter(eventsQueue: Queue, env: ApiEnv, storeId: string) {
  const router = Router();
  const emailSendService = createEmailSendService(eventsQueue);

  router.use("/admin", createAuthMiddleware(env, "ADMIN"));

  router.post("/admin/orders/:id/emails/:type/resend", async (req, res, next) => {
    try {
      const params = paramsSchema.safeParse(req.params);
      if (!params.success) {
        next(badRequest("Invalid request params", "INVALID_REQUEST"));
        return;
      }

      const query = querySchema.safeParse(req.query);
      if (!query.success) {
        next(badRequest("Invalid request query", "INVALID_REQUEST"));
        return;
      }

      const force = Boolean(query.data.force);
      const routes = await emailTemplateService.listRoutes(storeId);
      const route = routes.items.find((item: { type: string; enabled: boolean }) => item.type === params.data.type);

      if (!route) {
        next(badRequest("Email route not found", "EMAIL_ROUTE_NOT_FOUND"));
        return;
      }

      if (!route.enabled && !force) {
        next(badRequest("Email route is disabled. Use ?force=1 to override.", "EMAIL_ROUTE_DISABLED"));
        return;
      }

      const idempotencyKey = emailSendService.buildResendIdempotencyKey(params.data.id, params.data.type);
      const queued = await emailSendService.enqueueSendEmailJob({
        storeId,
        orderId: params.data.id,
        routeType: params.data.type,
        idempotencyKey,
        force
      });

      res.json({
        ...queued,
        routeEnabled: route.enabled,
        forced: force
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
