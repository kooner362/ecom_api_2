import { Router } from "express";
import { z } from "zod";
import type { ApiEnv } from "@ecom/shared";
import { createInventoryService } from "../services/inventoryService.js";
import { badRequest } from "../lib/errors.js";
import { createAuthMiddleware } from "../middleware/auth.js";
import { Queue } from "bullmq";

const locationCreateSchema = z.object({
  name: z.string().min(1).max(120),
  code: z.string().min(1).max(64).optional(),
  address: z.string().max(300).optional(),
  isActive: z.boolean().optional()
});

const locationUpdateSchema = z
  .object({
    name: z.string().min(1).max(120).optional(),
    address: z.string().max(300).nullable().optional(),
    isActive: z.boolean().optional()
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided"
  });

const idParamSchema = z.object({
  id: z.string().min(1)
});

const inventoryQuerySchema = z.object({
  variantId: z.string().min(1).optional(),
  locationId: z.string().min(1).optional()
});

const movementQuerySchema = z.object({
  variantId: z.string().min(1).optional(),
  locationId: z.string().min(1).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(200).default(50)
});

const adjustInventorySchema = z.object({
  variantId: z.string().min(1),
  locationId: z.string().min(1),
  delta: z.coerce.number().int(),
  note: z.string().max(1000).optional()
});

const thresholdSchema = z.object({
  variantId: z.string().min(1),
  locationId: z.string().min(1),
  threshold: z.coerce.number().int().nonnegative()
});

export function createAdminInventoryRouter(eventsQueue: Queue, env: ApiEnv, storeId: string) {
  const router = Router();
  const inventoryService = createInventoryService(eventsQueue);

  router.use("/admin", createAuthMiddleware(env, "ADMIN"));

  router.post("/admin/locations", async (req, res, next) => {
    try {
      const parsed = locationCreateSchema.safeParse(req.body);
      if (!parsed.success) {
        next(badRequest("Invalid request body", "INVALID_REQUEST"));
        return;
      }

      const location = await inventoryService.createLocation(storeId, parsed.data);
      res.status(201).json(location);
    } catch (error) {
      next(error);
    }
  });

  router.get("/admin/locations", async (_req, res, next) => {
    try {
      const locations = await inventoryService.listLocations(storeId);
      res.json({ items: locations });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/admin/locations/:id", async (req, res, next) => {
    try {
      const params = idParamSchema.safeParse(req.params);
      if (!params.success) {
        next(badRequest("Invalid location id", "INVALID_REQUEST"));
        return;
      }

      const parsed = locationUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        next(badRequest("Invalid request body", "INVALID_REQUEST"));
        return;
      }

      const location = await inventoryService.updateLocation(storeId, params.data.id, parsed.data);
      res.json(location);
    } catch (error) {
      next(error);
    }
  });

  router.delete("/admin/locations/:id", async (req, res, next) => {
    try {
      const params = idParamSchema.safeParse(req.params);
      if (!params.success) {
        next(badRequest("Invalid location id", "INVALID_REQUEST"));
        return;
      }

      const result = await inventoryService.deactivateLocation(storeId, params.data.id);
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.get("/admin/inventory", async (req, res, next) => {
    try {
      const parsed = inventoryQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        next(badRequest("Invalid query parameters", "INVALID_REQUEST"));
        return;
      }

      const inventory = await inventoryService.getInventory(storeId, parsed.data);
      res.json(inventory);
    } catch (error) {
      next(error);
    }
  });

  router.post("/admin/inventory/adjust", async (req, res, next) => {
    try {
      const parsed = adjustInventorySchema.safeParse(req.body);
      if (!parsed.success) {
        next(badRequest("Invalid request body", "INVALID_REQUEST"));
        return;
      }

      const updatedLevel = await inventoryService.adjustInventory(storeId, parsed.data, req.auth?.userId);
      res.json(updatedLevel);
    } catch (error) {
      next(error);
    }
  });

  router.put("/admin/inventory/threshold", async (req, res, next) => {
    try {
      const parsed = thresholdSchema.safeParse(req.body);
      if (!parsed.success) {
        next(badRequest("Invalid request body", "INVALID_REQUEST"));
        return;
      }

      const threshold = await inventoryService.setThreshold(storeId, parsed.data);
      res.json(threshold);
    } catch (error) {
      next(error);
    }
  });

  router.get("/admin/inventory/movements", async (req, res, next) => {
    try {
      const parsed = movementQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        next(badRequest("Invalid query parameters", "INVALID_REQUEST"));
        return;
      }

      const movements = await inventoryService.listMovements(storeId, parsed.data);
      res.json(movements);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
