import { Router } from "express";
import { z } from "zod";
import type { ApiEnv } from "@ecom/shared";
import { badRequest } from "../lib/errors.js";
import { createAuthMiddleware } from "../middleware/auth.js";
import { catalogService } from "../services/catalogService.js";

const categoryCreateSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(5000).optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.coerce.number().int().optional()
});

const categoryUpdateSchema = z
  .object({
    name: z.string().min(1).max(120).optional(),
    description: z.string().max(5000).nullable().optional(),
    isActive: z.boolean().optional(),
    sortOrder: z.coerce.number().int().optional()
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided"
  });

const idParamSchema = z.object({
  id: z.string().min(1)
});

export function createAdminCategoriesRouter(env: ApiEnv, storeId: string) {
  const router = Router();
  router.use("/admin", createAuthMiddleware(env, "ADMIN"));

  router.post("/admin/categories", async (req, res, next) => {
    try {
      const parsed = categoryCreateSchema.safeParse(req.body);
      if (!parsed.success) {
        next(badRequest("Invalid request body", "INVALID_REQUEST"));
        return;
      }

      const category = await catalogService.createCategory(storeId, parsed.data);
      res.status(201).json(category);
    } catch (error) {
      next(error);
    }
  });

  router.get("/admin/categories", async (_req, res, next) => {
    try {
      const categories = await catalogService.listAdminCategories(storeId);
      res.json({ items: categories });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/admin/categories/:id", async (req, res, next) => {
    try {
      const params = idParamSchema.safeParse(req.params);
      if (!params.success) {
        next(badRequest("Invalid category id", "INVALID_REQUEST"));
        return;
      }

      const parsed = categoryUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        next(badRequest("Invalid request body", "INVALID_REQUEST"));
        return;
      }

      const category = await catalogService.updateCategory(storeId, params.data.id, parsed.data);
      res.json(category);
    } catch (error) {
      next(error);
    }
  });

  router.delete("/admin/categories/:id", async (req, res, next) => {
    try {
      const params = idParamSchema.safeParse(req.params);
      if (!params.success) {
        next(badRequest("Invalid category id", "INVALID_REQUEST"));
        return;
      }

      const result = await catalogService.deleteCategory(storeId, params.data.id);
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
