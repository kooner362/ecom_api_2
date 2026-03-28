import { Router } from "express";
import { z } from "zod";
import { badRequest } from "../lib/errors.js";
import { contentService } from "../services/contentService.js";
import { storeSettingsService } from "../services/storeSettingsService.js";

const slugParamSchema = z.object({
  slug: z.string().min(1).max(120)
});

export function createStoreContentRouter(storeId: string) {
  const router = Router();

  router.get("/store/faqs", async (_req, res, next) => {
    try {
      const items = await contentService.listFaqs(storeId);
      res.json({ items });
    } catch (error) {
      next(error);
    }
  });

  router.get("/store/theme", async (_req, res, next) => {
    try {
      const theme = await contentService.getTheme(storeId);
      res.json(theme);
    } catch (error) {
      next(error);
    }
  });

  router.get("/store/settings", async (_req, res, next) => {
    try {
      const settings = await storeSettingsService.getPublic(storeId);
      res.json(settings);
    } catch (error) {
      next(error);
    }
  });

  router.get("/store/pages/:slug", async (req, res, next) => {
    try {
      const params = slugParamSchema.safeParse(req.params);
      if (!params.success) {
        next(badRequest("Invalid page slug", "INVALID_REQUEST"));
        return;
      }

      const page = await contentService.getPage(storeId, params.data.slug);
      res.json(page);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
