import { Router } from "express";
import { z } from "zod";
import type { ApiEnv } from "@ecom/shared";
import { badRequest } from "../lib/errors.js";
import { createAuthMiddleware } from "../middleware/auth.js";
import { contentService } from "../services/contentService.js";

const faqCreateSchema = z.object({
  question: z.string().min(1).max(500),
  answer: z.string().min(1).max(20000),
  sortOrder: z.coerce.number().int().optional()
});

const faqUpdateSchema = z
  .object({
    question: z.string().min(1).max(500).optional(),
    answer: z.string().min(1).max(20000).optional(),
    sortOrder: z.coerce.number().int().optional()
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided"
  });

const idParamSchema = z.object({
  id: z.string().min(1)
});

export function createAdminFaqsRouter(env: ApiEnv, storeId: string) {
  const router = Router();
  router.use("/admin", createAuthMiddleware(env, "ADMIN"));

  router.get("/admin/faqs", async (_req, res, next) => {
    try {
      const items = await contentService.listFaqs(storeId);
      res.json({ items });
    } catch (error) {
      next(error);
    }
  });

  router.post("/admin/faqs", async (req, res, next) => {
    try {
      const parsed = faqCreateSchema.safeParse(req.body);
      if (!parsed.success) {
        next(badRequest("Invalid request body", "INVALID_REQUEST"));
        return;
      }

      const created = await contentService.createFaq(storeId, parsed.data);
      res.status(201).json(created);
    } catch (error) {
      next(error);
    }
  });

  router.patch("/admin/faqs/:id", async (req, res, next) => {
    try {
      const params = idParamSchema.safeParse(req.params);
      if (!params.success) {
        next(badRequest("Invalid FAQ id", "INVALID_REQUEST"));
        return;
      }

      const parsed = faqUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        next(badRequest("Invalid request body", "INVALID_REQUEST"));
        return;
      }

      const updated = await contentService.updateFaq(storeId, params.data.id, parsed.data);
      res.json(updated);
    } catch (error) {
      next(error);
    }
  });

  router.delete("/admin/faqs/:id", async (req, res, next) => {
    try {
      const params = idParamSchema.safeParse(req.params);
      if (!params.success) {
        next(badRequest("Invalid FAQ id", "INVALID_REQUEST"));
        return;
      }

      const result = await contentService.deleteFaq(storeId, params.data.id);
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
