import { Router } from "express";
import { z } from "zod";
import { prisma } from "@ecom/db";
import type { ApiEnv } from "@ecom/shared";
import { badRequest } from "../lib/errors.js";
import { createAuthMiddleware } from "../middleware/auth.js";

const db = prisma as any;

const taxRateCreateSchema = z.object({
  name: z.string().min(1).max(120),
  enabled: z.boolean().optional(),
  country: z.string().min(1).max(8).nullable().optional(),
  province: z.string().min(1).max(32).nullable().optional(),
  postalPrefix: z.string().min(1).max(16).nullable().optional(),
  rateBps: z.coerce.number().int().nonnegative(),
  priority: z.coerce.number().int().optional()
});

const taxRateUpdateSchema = z
  .object({
    name: z.string().min(1).max(120).optional(),
    enabled: z.boolean().optional(),
    country: z.string().min(1).max(8).nullable().optional(),
    province: z.string().min(1).max(32).nullable().optional(),
    postalPrefix: z.string().min(1).max(16).nullable().optional(),
    rateBps: z.coerce.number().int().nonnegative().optional(),
    priority: z.coerce.number().int().optional()
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided"
  });

const idParamSchema = z.object({
  id: z.string().min(1)
});

function normalizeNullable(value?: string | null): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  const normalized = value.trim().toUpperCase();
  return normalized.length > 0 ? normalized : null;
}

function mapTaxRate(rate: any) {
  return {
    id: rate.id,
    name: rate.name,
    enabled: rate.enabled,
    country: rate.country,
    province: rate.province,
    postalPrefix: rate.postalPrefix,
    rateBps: rate.rateBps,
    priority: rate.priority,
    createdAt: rate.createdAt,
    updatedAt: rate.updatedAt
  };
}

export function createAdminTaxRatesRouter(env: ApiEnv, storeId: string) {
  const router = Router();

  router.use("/admin", createAuthMiddleware(env, "ADMIN"));

  router.get("/admin/tax-rates", async (_req, res, next) => {
    try {
      const items = await db.taxRate.findMany({
        where: { storeId },
        orderBy: [{ priority: "desc" }, { createdAt: "asc" }, { id: "asc" }]
      });

      res.json({ items: items.map(mapTaxRate) });
    } catch (error) {
      next(error);
    }
  });

  router.post("/admin/tax-rates", async (req, res, next) => {
    try {
      const parsed = taxRateCreateSchema.safeParse(req.body);
      if (!parsed.success) {
        next(badRequest("Invalid request body", "INVALID_REQUEST"));
        return;
      }

      const created = await db.taxRate.create({
        data: {
          storeId,
          name: parsed.data.name,
          enabled: parsed.data.enabled ?? true,
          country: normalizeNullable(parsed.data.country),
          province: normalizeNullable(parsed.data.province),
          postalPrefix: normalizeNullable(parsed.data.postalPrefix),
          rateBps: parsed.data.rateBps,
          priority: parsed.data.priority ?? 0
        }
      });

      res.status(201).json(mapTaxRate(created));
    } catch (error) {
      next(error);
    }
  });

  router.patch("/admin/tax-rates/:id", async (req, res, next) => {
    try {
      const params = idParamSchema.safeParse(req.params);
      if (!params.success) {
        next(badRequest("Invalid tax rate id", "INVALID_REQUEST"));
        return;
      }

      const parsed = taxRateUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        next(badRequest("Invalid request body", "INVALID_REQUEST"));
        return;
      }

      const existing = await db.taxRate.findFirst({ where: { id: params.data.id, storeId } });
      if (!existing) {
        next(badRequest("Tax rate not found", "TAX_RATE_NOT_FOUND"));
        return;
      }

      const updated = await db.taxRate.update({
        where: { id: existing.id },
        data: {
          name: parsed.data.name ?? existing.name,
          enabled: parsed.data.enabled ?? existing.enabled,
          country:
            parsed.data.country === undefined ? existing.country : normalizeNullable(parsed.data.country),
          province:
            parsed.data.province === undefined ? existing.province : normalizeNullable(parsed.data.province),
          postalPrefix:
            parsed.data.postalPrefix === undefined
              ? existing.postalPrefix
              : normalizeNullable(parsed.data.postalPrefix),
          rateBps: parsed.data.rateBps ?? existing.rateBps,
          priority: parsed.data.priority ?? existing.priority
        }
      });

      res.json(mapTaxRate(updated));
    } catch (error) {
      next(error);
    }
  });

  router.delete("/admin/tax-rates/:id", async (req, res, next) => {
    try {
      const params = idParamSchema.safeParse(req.params);
      if (!params.success) {
        next(badRequest("Invalid tax rate id", "INVALID_REQUEST"));
        return;
      }

      const existing = await db.taxRate.findFirst({
        where: { id: params.data.id, storeId },
        select: { id: true }
      });

      if (!existing) {
        next(badRequest("Tax rate not found", "TAX_RATE_NOT_FOUND"));
        return;
      }

      await db.taxRate.delete({ where: { id: existing.id } });
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
