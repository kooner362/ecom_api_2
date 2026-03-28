import { Router } from "express";
import { z } from "zod";
import type { ApiEnv } from "@ecom/shared";
import { badRequest } from "../lib/errors.js";
import { createAuthMiddleware } from "../middleware/auth.js";
import { catalogService } from "../services/catalogService.js";

const statusEnum = z.enum(["DRAFT", "ACTIVE"]);

const imageSchema = z.object({
  url: z.string().url(),
  alt: z.string().max(300).optional(),
  sortOrder: z.coerce.number().int().optional()
});

const optionValueSchema = z.object({
  value: z.string().min(1).max(120),
  position: z.coerce.number().int().optional()
});

const optionSchema = z.object({
  name: z.string().min(1).max(120),
  position: z.coerce.number().int().optional(),
  values: z.array(optionValueSchema).min(1)
});

const variantSelectionSchema = z.object({
  optionName: z.string().min(1).max(120),
  value: z.string().min(1).max(120)
});

const variantSchema = z.object({
  sku: z.string().max(120).optional(),
  title: z.string().min(1).max(200).optional(),
  priceCents: z.coerce.number().int().nonnegative(),
  costCents: z.coerce.number().int().nonnegative().optional(),
  compareAtPriceCents: z.coerce.number().int().nonnegative().optional(),
  isActive: z.boolean().optional(),
  selections: z.array(variantSelectionSchema).optional()
});

const productCreateSchema = z
  .object({
    title: z.string().min(1).max(200),
    description: z.string().max(10000).optional(),
    videoUrl: z.string().url().max(500).optional(),
    status: statusEnum.default("DRAFT"),
    featured: z.boolean().optional(),
    badges: z.array(z.enum(["new", "bestseller", "featured"])).optional(),
    tags: z.array(z.string().min(1).max(60)).optional(),
    priceCents: z.coerce.number().int().nonnegative().optional(),
    costCents: z.coerce.number().int().nonnegative().optional(),
    compareAtPriceCents: z.coerce.number().int().nonnegative().optional(),
    categoryIds: z.array(z.string().min(1)).optional(),
    images: z.array(imageSchema).optional(),
    options: z.array(optionSchema).optional(),
    variants: z.array(variantSchema).optional()
  })
  .superRefine((value, ctx) => {
    const hasOptions = Array.isArray(value.options) && value.options.length > 0;
    const hasVariants = Array.isArray(value.variants) && value.variants.length > 0;

    if (!hasOptions && !hasVariants && typeof value.priceCents !== "number") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["priceCents"],
        message: "priceCents is required for simple products"
      });
    }

    if (hasOptions !== hasVariants) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["options"],
        message: "options and variants must both be provided for variant products"
      });
    }
  });

const productUpdateSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    description: z.string().max(10000).nullable().optional(),
    videoUrl: z.string().url().max(500).nullable().optional(),
    status: statusEnum.optional(),
    featured: z.boolean().optional(),
    badges: z.array(z.enum(["new", "bestseller", "featured"])).optional(),
    tags: z.array(z.string().min(1).max(60)).optional(),
    categoryIds: z.array(z.string().min(1)).optional(),
    images: z.array(imageSchema).optional()
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided"
  });

const replaceVariantsSchema = z.object({
  options: z.array(optionSchema).min(1),
  variants: z.array(variantSchema).min(1)
});

const variantUpdateSchema = z
  .object({
    sku: z.string().max(120).nullable().optional(),
    title: z.string().min(1).max(200).optional(),
    priceCents: z.coerce.number().int().nonnegative().optional(),
    costCents: z.coerce.number().int().nonnegative().nullable().optional(),
    compareAtPriceCents: z.coerce.number().int().nonnegative().nullable().optional(),
    isActive: z.boolean().optional()
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided"
  });

const productListQuerySchema = z.object({
  status: statusEnum.optional(),
  q: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(200).default(20)
});

const idParamSchema = z.object({
  id: z.string().min(1)
});

const featuredUpdateSchema = z.object({
  featured: z.boolean()
});

export function createAdminProductsRouter(env: ApiEnv, storeId: string) {
  const router = Router();
  router.use("/admin", createAuthMiddleware(env, "ADMIN"));

  router.post("/admin/products", async (req, res, next) => {
    try {
      const parsed = productCreateSchema.safeParse(req.body);
      if (!parsed.success) {
        next(badRequest("Invalid request body", "INVALID_REQUEST"));
        return;
      }

      const product = await catalogService.createProduct(storeId, parsed.data);
      res.status(201).json(product);
    } catch (error) {
      next(error);
    }
  });

  router.get("/admin/products", async (req, res, next) => {
    try {
      const parsed = productListQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        next(badRequest("Invalid query parameters", "INVALID_REQUEST"));
        return;
      }

      const result = await catalogService.listAdminProducts(storeId, parsed.data);
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.get("/admin/products/:id", async (req, res, next) => {
    try {
      const params = idParamSchema.safeParse(req.params);
      if (!params.success) {
        next(badRequest("Invalid product id", "INVALID_REQUEST"));
        return;
      }

      const product = await catalogService.getAdminProductById(storeId, params.data.id);
      res.json(product);
    } catch (error) {
      next(error);
    }
  });

  router.patch("/admin/products/:id", async (req, res, next) => {
    try {
      const params = idParamSchema.safeParse(req.params);
      if (!params.success) {
        next(badRequest("Invalid product id", "INVALID_REQUEST"));
        return;
      }

      const parsed = productUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        next(badRequest("Invalid request body", "INVALID_REQUEST"));
        return;
      }

      const product = await catalogService.updateProduct(storeId, params.data.id, parsed.data);
      res.json(product);
    } catch (error) {
      next(error);
    }
  });

  router.post("/admin/products/:id/variants", async (req, res, next) => {
    try {
      const params = idParamSchema.safeParse(req.params);
      if (!params.success) {
        next(badRequest("Invalid product id", "INVALID_REQUEST"));
        return;
      }

      const parsed = replaceVariantsSchema.safeParse(req.body);
      if (!parsed.success) {
        next(badRequest("Invalid request body", "INVALID_REQUEST"));
        return;
      }

      const product = await catalogService.replaceProductVariants(storeId, params.data.id, parsed.data);
      res.json(product);
    } catch (error) {
      next(error);
    }
  });

  router.patch("/admin/variants/:id", async (req, res, next) => {
    try {
      const params = idParamSchema.safeParse(req.params);
      if (!params.success) {
        next(badRequest("Invalid variant id", "INVALID_REQUEST"));
        return;
      }

      const parsed = variantUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        next(badRequest("Invalid request body", "INVALID_REQUEST"));
        return;
      }

      const variant = await catalogService.updateVariant(storeId, params.data.id, parsed.data);
      res.json(variant);
    } catch (error) {
      next(error);
    }
  });

  router.delete("/admin/variants/:id", async (req, res, next) => {
    try {
      const params = idParamSchema.safeParse(req.params);
      if (!params.success) {
        next(badRequest("Invalid variant id", "INVALID_REQUEST"));
        return;
      }

      const result = await catalogService.deactivateVariant(storeId, params.data.id);
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.delete("/admin/products/:id", async (req, res, next) => {
    try {
      const params = idParamSchema.safeParse(req.params);
      if (!params.success) {
        next(badRequest("Invalid product id", "INVALID_REQUEST"));
        return;
      }

      const result = await catalogService.deleteProduct(storeId, params.data.id);
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.patch("/admin/products/:id/featured", async (req, res, next) => {
    try {
      const params = idParamSchema.safeParse(req.params);
      if (!params.success) {
        next(badRequest("Invalid product id", "INVALID_REQUEST"));
        return;
      }

      const parsed = featuredUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        next(badRequest("Invalid request body", "INVALID_REQUEST"));
        return;
      }

      const product = await catalogService.setProductFeatured(storeId, params.data.id, parsed.data.featured);
      res.json(product);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
