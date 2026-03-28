import { Router } from "express";
import { z } from "zod";
import type { ApiEnv } from "@ecom/shared";
import { badRequest } from "../lib/errors.js";
import { createAuthMiddleware } from "../middleware/auth.js";
import { emailTemplateService, EMAIL_ROUTE_TYPES } from "../services/emailTemplateService.js";

const typeSchema = z.enum(EMAIL_ROUTE_TYPES);

const typeParamSchema = z.object({
  type: typeSchema
});

const routeUpdateSchema = z.object({
  enabled: z.boolean()
});

const recipientsSchema = z.object({
  to: z.array(z.string().email()).default([]),
  cc: z.array(z.string().email()).default([]),
  bcc: z.array(z.string().email()).default([])
});

const templateSchema = z.object({
  subject: z.string().min(1).max(300),
  html: z.string().min(1),
  text: z.string().optional()
});

const previewSchema = z.object({
  orderId: z.string().min(1).optional()
});

export function createAdminEmailSettingsRouter(env: ApiEnv, storeId: string) {
  const router = Router();
  router.use("/admin", createAuthMiddleware(env, "ADMIN"));

  router.get("/admin/settings/emails/routes", async (_req, res, next) => {
    try {
      const routes = await emailTemplateService.listRoutes(storeId);
      res.json(routes);
    } catch (error) {
      next(error);
    }
  });

  router.patch("/admin/settings/emails/routes/:type", async (req, res, next) => {
    try {
      const params = typeParamSchema.safeParse(req.params);
      if (!params.success) {
        next(badRequest("Invalid route type", "INVALID_REQUEST"));
        return;
      }

      const body = routeUpdateSchema.safeParse(req.body);
      if (!body.success) {
        next(badRequest("Invalid request body", "INVALID_REQUEST"));
        return;
      }

      const route = await emailTemplateService.updateRoute(storeId, params.data.type, body.data.enabled);
      res.json(route);
    } catch (error) {
      next(error);
    }
  });

  router.get("/admin/settings/emails/recipients/:type", async (req, res, next) => {
    try {
      const params = typeParamSchema.safeParse(req.params);
      if (!params.success) {
        next(badRequest("Invalid route type", "INVALID_REQUEST"));
        return;
      }

      const recipients = await emailTemplateService.getRecipientsByRouteType(storeId, params.data.type);
      res.json(recipients);
    } catch (error) {
      next(error);
    }
  });

  router.put("/admin/settings/emails/recipients/:type", async (req, res, next) => {
    try {
      const params = typeParamSchema.safeParse(req.params);
      if (!params.success) {
        next(badRequest("Invalid route type", "INVALID_REQUEST"));
        return;
      }

      const body = recipientsSchema.safeParse(req.body);
      if (!body.success) {
        next(badRequest("Invalid request body", "INVALID_REQUEST"));
        return;
      }

      const recipients = await emailTemplateService.setRecipientsByRouteType(storeId, params.data.type, body.data);
      res.json(recipients);
    } catch (error) {
      next(error);
    }
  });

  router.get("/admin/settings/emails/templates/:type", async (req, res, next) => {
    try {
      const params = typeParamSchema.safeParse(req.params);
      if (!params.success) {
        next(badRequest("Invalid route type", "INVALID_REQUEST"));
        return;
      }

      const template = await emailTemplateService.getTemplateByRouteType(storeId, params.data.type);
      res.json(template);
    } catch (error) {
      next(error);
    }
  });

  router.put("/admin/settings/emails/templates/:type", async (req, res, next) => {
    try {
      const params = typeParamSchema.safeParse(req.params);
      if (!params.success) {
        next(badRequest("Invalid route type", "INVALID_REQUEST"));
        return;
      }

      const body = templateSchema.safeParse(req.body);
      if (!body.success) {
        next(badRequest("Invalid request body", "INVALID_REQUEST"));
        return;
      }

      const template = await emailTemplateService.setTemplateByRouteType(storeId, params.data.type, body.data);
      res.json(template);
    } catch (error) {
      next(error);
    }
  });

  router.post("/admin/settings/emails/templates/:type/preview", async (req, res, next) => {
    try {
      const params = typeParamSchema.safeParse(req.params);
      if (!params.success) {
        next(badRequest("Invalid route type", "INVALID_REQUEST"));
        return;
      }

      const body = previewSchema.safeParse(req.body ?? {});
      if (!body.success) {
        next(badRequest("Invalid request body", "INVALID_REQUEST"));
        return;
      }

      const preview = await emailTemplateService.previewByRouteType(storeId, params.data.type, body.data.orderId);
      res.json({
        subject: preview.rendered.subject,
        html: preview.rendered.html,
        text: preview.rendered.text,
        resolvedRecipients: preview.resolvedRecipients
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
