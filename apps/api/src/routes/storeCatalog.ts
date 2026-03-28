import { Router } from "express";
import { z } from "zod";
import { badRequest } from "../lib/errors.js";
import { catalogService } from "../services/catalogService.js";

const productsQuerySchema = z.object({
  categorySlug: z.string().optional(),
  q: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20)
});

const slugParamSchema = z.object({
  slug: z.string().min(1)
});

export function createStoreCatalogRouter(storeId: string) {
  const router = Router();

  router.get("/store/categories", async (_req, res, next) => {
    try {
      const categories = await catalogService.listStoreCategories(storeId);
      res.json({ items: categories });
    } catch (error) {
      next(error);
    }
  });

  router.get("/store/products", async (req, res, next) => {
    try {
      const parsed = productsQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        next(badRequest("Invalid query parameters", "INVALID_REQUEST"));
        return;
      }

      const result = await catalogService.listStoreProducts(storeId, parsed.data);
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.get("/store/products/:slug", async (req, res, next) => {
    try {
      const params = slugParamSchema.safeParse(req.params);
      if (!params.success) {
        next(badRequest("Invalid product slug", "INVALID_REQUEST"));
        return;
      }

      const product = await catalogService.getStoreProductBySlug(storeId, params.data.slug);
      res.json(product);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
