import { Router } from "express";
import { z } from "zod";
import type { ApiEnv } from "@ecom/shared";
import { badRequest } from "../lib/errors.js";
import { createAuthMiddleware } from "../middleware/auth.js";
import { contentService } from "../services/contentService.js";

const themeUpdateSchema = z
  .object({
    primaryColor: z.string().min(1).max(20).optional(),
    secondaryColor: z.string().min(1).max(20).optional(),
    buttonColor: z.string().min(1).max(20).optional(),
    headerBgColor: z.string().min(1).max(20).optional(),
    font: z.string().min(1).max(100).optional(),
    tagline: z.string().min(1).max(500).optional(),
    showFeaturedSection: z.boolean().optional(),
    showCategorySection: z.boolean().optional(),
    showNewsletterSection: z.boolean().optional(),
    sectionOrder: z.array(z.string().min(1)).min(1).optional()
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided"
  });

export function createAdminThemeRouter(env: ApiEnv, storeId: string) {
  const router = Router();
  router.use("/admin", createAuthMiddleware(env, "ADMIN"));

  router.get("/admin/theme", async (_req, res, next) => {
    try {
      const theme = await contentService.getTheme(storeId);
      res.json(theme);
    } catch (error) {
      next(error);
    }
  });

  router.patch("/admin/theme", async (req, res, next) => {
    try {
      const parsed = themeUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        next(badRequest("Invalid request body", "INVALID_REQUEST"));
        return;
      }

      const theme = await contentService.updateTheme(storeId, parsed.data);
      res.json(theme);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
