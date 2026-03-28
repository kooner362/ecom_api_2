import { Router } from "express";
import { z } from "zod";
import type { ApiEnv } from "@ecom/shared";
import { badRequest } from "../lib/errors.js";
import { createAuthMiddleware } from "../middleware/auth.js";
import { storeSettingsService } from "../services/storeSettingsService.js";

const dayOfWeekEnum = z.enum(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]);
const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;
const dataImagePattern = /^data:image\/(png|jpeg|jpg|webp|gif|svg\+xml);base64,[a-zA-Z0-9+/=\s]+$/;
const logoUrlSchema = z.union([
  z.string().url().max(4000),
  z.string().regex(dataImagePattern).max(400000)
]);

const updateSchema = z
  .object({
    name: z.string().min(1).max(120).optional(),
    email: z.string().email().nullable().optional(),
    websiteUrl: z.string().url().max(300).nullable().optional(),
    businessType: z.string().min(1).max(80).nullable().optional(),
    phone: z.string().max(40).nullable().optional(),
    addressLine1: z.string().max(180).nullable().optional(),
    addressLine2: z.string().max(180).nullable().optional(),
    city: z.string().max(120).nullable().optional(),
    stateOrProvince: z.string().max(120).nullable().optional(),
    postalCode: z.string().max(30).nullable().optional(),
    countryCode: z.string().max(2).nullable().optional(),
    logoUrl: logoUrlSchema.nullable().optional(),
    sameAs: z.array(z.string().url().max(300)).nullable().optional(),
    openingHours: z
      .array(
        z.object({
          dayOfWeek: dayOfWeekEnum,
          opens: z.string().regex(timePattern).nullable().optional(),
          closes: z.string().regex(timePattern).nullable().optional(),
          closed: z.boolean().optional()
        })
      )
      .nullable()
      .optional(),
    priceRange: z.string().max(20).nullable().optional(),
    geoLat: z.number().min(-90).max(90).nullable().optional(),
    geoLng: z.number().min(-180).max(180).nullable().optional(),
    googleMapsUrl: z.string().url().max(500).nullable().optional(),
    hasPhysicalStorefront: z.boolean().optional(),
    currency: z.string().min(1).max(10).optional(),
    timezone: z.string().min(1).max(120).optional()
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided"
  });

export function createAdminSettingsStoreRouter(env: ApiEnv, storeId: string) {
  const router = Router();
  router.use("/admin", createAuthMiddleware(env, "ADMIN"));

  router.get("/admin/settings/store", async (_req, res, next) => {
    try {
      const settings = await storeSettingsService.get(storeId);
      res.json(settings);
    } catch (error) {
      next(error);
    }
  });

  router.patch("/admin/settings/store", async (req, res, next) => {
    try {
      const parsed = updateSchema.safeParse(req.body);
      if (!parsed.success) {
        next(badRequest("Invalid request body", "INVALID_REQUEST"));
        return;
      }

      const settings = await storeSettingsService.update(storeId, parsed.data);
      res.json(settings);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
