import { Router } from "express";
import { z } from "zod";
import { prisma } from "@ecom/db";
import type { ApiEnv } from "@ecom/shared";
import { badRequest, unauthorized } from "../lib/errors.js";
import { createAuthMiddleware } from "../middleware/auth.js";

const db = prisma as any;

const addressCreateSchema = z.object({
  name: z.string().min(1).max(120),
  line1: z.string().min(1).max(200),
  line2: z.string().max(200).optional(),
  city: z.string().min(1).max(120),
  province: z.string().min(1).max(64),
  country: z.string().min(2).max(8),
  postalCode: z.string().min(1).max(32),
  phone: z.string().max(32).optional(),
  isDefault: z.boolean().optional()
});

const addressUpdateSchema = z
  .object({
    name: z.string().min(1).max(120).optional(),
    line1: z.string().min(1).max(200).optional(),
    line2: z.string().max(200).nullable().optional(),
    city: z.string().min(1).max(120).optional(),
    province: z.string().min(1).max(64).optional(),
    country: z.string().min(2).max(8).optional(),
    postalCode: z.string().min(1).max(32).optional(),
    phone: z.string().max(32).nullable().optional(),
    isDefault: z.boolean().optional()
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided"
  });

const idParamSchema = z.object({
  id: z.string().min(1)
});

function mapAddress(address: any) {
  return {
    id: address.id,
    name: address.name,
    line1: address.line1,
    line2: address.line2,
    city: address.city,
    province: address.province,
    country: address.country,
    postalCode: address.postalCode,
    phone: address.phone,
    isDefault: address.isDefault,
    createdAt: address.createdAt,
    updatedAt: address.updatedAt
  };
}

export function createStoreAddressesRouter(env: ApiEnv, storeId: string) {
  const router = Router();

  router.use("/store", createAuthMiddleware(env, "CUSTOMER"));

  router.get("/store/addresses", async (req, res, next) => {
    try {
      if (!req.auth) {
        next(unauthorized());
        return;
      }
      const auth = req.auth;

      const items = await db.address.findMany({
        where: {
          storeId,
          customerId: auth.userId
        },
        orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }]
      });

      res.json({ items: items.map(mapAddress) });
    } catch (error) {
      next(error);
    }
  });

  router.post("/store/addresses", async (req, res, next) => {
    try {
      if (!req.auth) {
        next(unauthorized());
        return;
      }
      const auth = req.auth;

      const parsed = addressCreateSchema.safeParse(req.body);
      if (!parsed.success) {
        next(badRequest("Invalid request body", "INVALID_REQUEST"));
        return;
      }

      const created = await db.$transaction(async (tx: any) => {
        const shouldBeDefault = Boolean(parsed.data.isDefault);
        if (shouldBeDefault) {
          await tx.address.updateMany({
            where: { storeId, customerId: auth.userId },
            data: { isDefault: false }
          });
        }

        const hasAny = await tx.address.count({
          where: { storeId, customerId: auth.userId }
        });

        return tx.address.create({
          data: {
            storeId,
            customerId: auth.userId,
            name: parsed.data.name,
            line1: parsed.data.line1,
            line2: parsed.data.line2,
            city: parsed.data.city,
            province: parsed.data.province.toUpperCase(),
            country: parsed.data.country.toUpperCase(),
            postalCode: parsed.data.postalCode.toUpperCase().trim(),
            phone: parsed.data.phone,
            isDefault: shouldBeDefault || hasAny === 0
          }
        });
      });

      res.status(201).json(mapAddress(created));
    } catch (error) {
      next(error);
    }
  });

  router.patch("/store/addresses/:id", async (req, res, next) => {
    try {
      if (!req.auth) {
        next(unauthorized());
        return;
      }
      const auth = req.auth;

      const params = idParamSchema.safeParse(req.params);
      if (!params.success) {
        next(badRequest("Invalid address id", "INVALID_REQUEST"));
        return;
      }

      const parsed = addressUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        next(badRequest("Invalid request body", "INVALID_REQUEST"));
        return;
      }

      const existing = await db.address.findFirst({
        where: {
          id: params.data.id,
          storeId,
          customerId: auth.userId
        }
      });

      if (!existing) {
        next(badRequest("Address not found", "ADDRESS_NOT_FOUND"));
        return;
      }

      const updated = await db.$transaction(async (tx: any) => {
        if (parsed.data.isDefault === true) {
          await tx.address.updateMany({
            where: { storeId, customerId: auth.userId },
            data: { isDefault: false }
          });
        }

        return tx.address.update({
          where: { id: existing.id },
          data: {
            ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
            ...(parsed.data.line1 !== undefined ? { line1: parsed.data.line1 } : {}),
            ...(parsed.data.line2 !== undefined ? { line2: parsed.data.line2 } : {}),
            ...(parsed.data.city !== undefined ? { city: parsed.data.city } : {}),
            ...(parsed.data.province !== undefined ? { province: parsed.data.province.toUpperCase() } : {}),
            ...(parsed.data.country !== undefined ? { country: parsed.data.country.toUpperCase() } : {}),
            ...(parsed.data.postalCode !== undefined
              ? { postalCode: parsed.data.postalCode.toUpperCase().trim() }
              : {}),
            ...(parsed.data.phone !== undefined ? { phone: parsed.data.phone } : {}),
            ...(parsed.data.isDefault !== undefined ? { isDefault: parsed.data.isDefault } : {})
          }
        });
      });

      res.json(mapAddress(updated));
    } catch (error) {
      next(error);
    }
  });

  router.delete("/store/addresses/:id", async (req, res, next) => {
    try {
      if (!req.auth) {
        next(unauthorized());
        return;
      }
      const auth = req.auth;

      const params = idParamSchema.safeParse(req.params);
      if (!params.success) {
        next(badRequest("Invalid address id", "INVALID_REQUEST"));
        return;
      }

      const existing = await db.address.findFirst({
        where: {
          id: params.data.id,
          storeId,
          customerId: auth.userId
        }
      });

      if (!existing) {
        next(badRequest("Address not found", "ADDRESS_NOT_FOUND"));
        return;
      }

      await db.$transaction(async (tx: any) => {
        await tx.address.delete({ where: { id: existing.id } });

        if (existing.isDefault) {
          const nextDefault = await tx.address.findFirst({
            where: { storeId, customerId: auth.userId },
            orderBy: [{ createdAt: "desc" }]
          });

          if (nextDefault) {
            await tx.address.update({
              where: { id: nextDefault.id },
              data: { isDefault: true }
            });
          }
        }
      });

      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
