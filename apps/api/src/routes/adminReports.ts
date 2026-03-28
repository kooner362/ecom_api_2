import { Router } from "express";
import { z } from "zod";
import type { ApiEnv } from "@ecom/shared";
import { badRequest } from "../lib/errors.js";
import { createAuthMiddleware } from "../middleware/auth.js";
import { reportingService } from "../services/reportingService.js";

const periodEnum = z.enum(["7d", "30d", "90d"]);

const baseRangeQuerySchema = z.object({
  period: periodEnum.default("30d"),
  start: z.string().datetime().optional(),
  end: z.string().datetime().optional()
});

const salesByProductQuerySchema = baseRangeQuerySchema.extend({
  limit: z.coerce.number().int().positive().max(100).default(10)
});

const inventoryQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(200).default(25)
});

function resolveRange(input: z.infer<typeof baseRangeQuerySchema>) {
  if (input.start || input.end) {
    if (!input.start || !input.end) {
      throw badRequest("Both start and end must be provided", "INVALID_REQUEST");
    }

    const start = new Date(input.start);
    const end = new Date(input.end);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
      throw badRequest("Invalid start/end range", "INVALID_REQUEST");
    }

    return { start, end };
  }

  const end = new Date();
  const start = new Date(end);
  const days = input.period === "7d" ? 7 : input.period === "90d" ? 90 : 30;
  start.setDate(start.getDate() - (days - 1));
  start.setHours(0, 0, 0, 0);

  return { start, end };
}

export function createAdminReportsRouter(env: ApiEnv, storeId: string) {
  const router = Router();
  router.use("/admin", createAuthMiddleware(env, "ADMIN"));

  router.get("/admin/reports/sales-snapshot", async (req, res, next) => {
    try {
      const parsed = baseRangeQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        next(badRequest("Invalid query parameters", "INVALID_REQUEST"));
        return;
      }

      const range = resolveRange(parsed.data);
      const result = await reportingService.salesSnapshot(storeId, range);
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.get("/admin/reports/sales-by-product", async (req, res, next) => {
    try {
      const parsed = salesByProductQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        next(badRequest("Invalid query parameters", "INVALID_REQUEST"));
        return;
      }

      const range = resolveRange(parsed.data);
      const result = await reportingService.salesByProduct(storeId, range, parsed.data.limit);
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.get("/admin/reports/inventory-on-hand-cost", async (req, res, next) => {
    try {
      const parsed = inventoryQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        next(badRequest("Invalid query parameters", "INVALID_REQUEST"));
        return;
      }

      const result = await reportingService.inventoryOnHandCost(storeId, parsed.data.limit);
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
