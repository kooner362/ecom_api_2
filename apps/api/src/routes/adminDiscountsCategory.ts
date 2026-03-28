import { Router } from "express";
import { z } from "zod";
import { prisma } from "@ecom/db";
import type { ApiEnv } from "@ecom/shared";
import { badRequest } from "../lib/errors.js";
import { createAuthMiddleware } from "../middleware/auth.js";
import { discountService } from "../services/discountService.js";

const db = prisma as any;

const discountTypeSchema = z.enum(["PERCENT", "FIXED"]);

const categoryDiscountCreateSchema = z
  .object({
    categoryId: z.string().min(1),
    enabled: z.boolean().optional(),
    type: discountTypeSchema,
    percentBps: z.coerce.number().int().nonnegative().nullable().optional(),
    amountCents: z.coerce.number().int().nonnegative().nullable().optional(),
    startsAt: z.coerce.date().nullable().optional(),
    endsAt: z.coerce.date().nullable().optional()
  })
  .superRefine((value, ctx) => {
    if (value.type === "PERCENT" && typeof value.percentBps !== "number") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["percentBps"],
        message: "percentBps is required for PERCENT discounts"
      });
    }

    if (value.type === "FIXED" && typeof value.amountCents !== "number") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["amountCents"],
        message: "amountCents is required for FIXED discounts"
      });
    }
  });

const categoryDiscountUpdateSchema = z
  .object({
    categoryId: z.string().min(1).optional(),
    enabled: z.boolean().optional(),
    type: discountTypeSchema.optional(),
    percentBps: z.coerce.number().int().nonnegative().nullable().optional(),
    amountCents: z.coerce.number().int().nonnegative().nullable().optional(),
    startsAt: z.coerce.date().nullable().optional(),
    endsAt: z.coerce.date().nullable().optional()
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided"
  });

const idParamSchema = z.object({ id: z.string().min(1) });

function mapCategoryDiscount(discount: any) {
  return {
    id: discount.id,
    categoryId: discount.categoryId,
    enabled: discount.enabled,
    type: discount.type,
    percentBps: discount.percentBps,
    amountCents: discount.amountCents,
    startsAt: discount.startsAt,
    endsAt: discount.endsAt,
    createdAt: discount.createdAt,
    updatedAt: discount.updatedAt
  };
}

async function ensureCategoryInStore(storeId: string, categoryId: string) {
  const category = await db.category.findFirst({ where: { id: categoryId, storeId }, select: { id: true } });
  if (!category) {
    throw badRequest("Category not found", "CATEGORY_NOT_FOUND");
  }
}

export function createAdminDiscountsCategoryRouter(env: ApiEnv, storeId: string) {
  const router = Router();
  router.use("/admin", createAuthMiddleware(env, "ADMIN"));

  router.post("/admin/discounts/category", async (req, res, next) => {
    try {
      const parsed = categoryDiscountCreateSchema.safeParse(req.body);
      if (!parsed.success) {
        next(badRequest("Invalid request body", "INVALID_REQUEST"));
        return;
      }

      await ensureCategoryInStore(storeId, parsed.data.categoryId);
      discountService.validateDiscountConfig(parsed.data.type, parsed.data.percentBps, parsed.data.amountCents);

      const created = await db.categoryDiscount.create({
        data: {
          storeId,
          categoryId: parsed.data.categoryId,
          enabled: parsed.data.enabled ?? true,
          type: parsed.data.type,
          percentBps: parsed.data.type === "PERCENT" ? parsed.data.percentBps : null,
          amountCents: parsed.data.type === "FIXED" ? parsed.data.amountCents : null,
          startsAt: parsed.data.startsAt,
          endsAt: parsed.data.endsAt
        }
      });

      res.status(201).json(mapCategoryDiscount(created));
    } catch (error) {
      next(error);
    }
  });

  router.get("/admin/discounts/category", async (_req, res, next) => {
    try {
      const items = await db.categoryDiscount.findMany({
        where: { storeId },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }]
      });
      res.json({ items: items.map(mapCategoryDiscount) });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/admin/discounts/category/:id", async (req, res, next) => {
    try {
      const params = idParamSchema.safeParse(req.params);
      if (!params.success) {
        next(badRequest("Invalid category discount id", "INVALID_REQUEST"));
        return;
      }

      const parsed = categoryDiscountUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        next(badRequest("Invalid request body", "INVALID_REQUEST"));
        return;
      }

      const existing = await db.categoryDiscount.findFirst({ where: { id: params.data.id, storeId } });
      if (!existing) {
        next(badRequest("Category discount not found", "CATEGORY_DISCOUNT_NOT_FOUND"));
        return;
      }

      const nextType = parsed.data.type ?? existing.type;
      const nextPercentBps = parsed.data.percentBps === undefined ? existing.percentBps : parsed.data.percentBps;
      const nextAmountCents = parsed.data.amountCents === undefined ? existing.amountCents : parsed.data.amountCents;

      discountService.validateDiscountConfig(nextType, nextPercentBps, nextAmountCents);

      if (parsed.data.categoryId) {
        await ensureCategoryInStore(storeId, parsed.data.categoryId);
      }

      const updated = await db.categoryDiscount.update({
        where: { id: existing.id },
        data: {
          categoryId: parsed.data.categoryId ?? existing.categoryId,
          enabled: parsed.data.enabled ?? existing.enabled,
          type: nextType,
          percentBps: nextType === "PERCENT" ? nextPercentBps : null,
          amountCents: nextType === "FIXED" ? nextAmountCents : null,
          startsAt: parsed.data.startsAt === undefined ? existing.startsAt : parsed.data.startsAt,
          endsAt: parsed.data.endsAt === undefined ? existing.endsAt : parsed.data.endsAt
        }
      });

      res.json(mapCategoryDiscount(updated));
    } catch (error) {
      next(error);
    }
  });

  router.delete("/admin/discounts/category/:id", async (req, res, next) => {
    try {
      const params = idParamSchema.safeParse(req.params);
      if (!params.success) {
        next(badRequest("Invalid category discount id", "INVALID_REQUEST"));
        return;
      }

      const existing = await db.categoryDiscount.findFirst({
        where: { id: params.data.id, storeId },
        select: { id: true }
      });

      if (!existing) {
        next(badRequest("Category discount not found", "CATEGORY_DISCOUNT_NOT_FOUND"));
        return;
      }

      await db.categoryDiscount.delete({ where: { id: existing.id } });
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
