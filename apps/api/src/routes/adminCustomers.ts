import { Router } from "express";
import { z } from "zod";
import type { ApiEnv } from "@ecom/shared";
import { badRequest } from "../lib/errors.js";
import { createAuthMiddleware } from "../middleware/auth.js";
import { customerService } from "../services/customerService.js";

const listQuerySchema = z.object({
  q: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20)
});

const idParamSchema = z.object({
  id: z.string().min(1)
});

export function createAdminCustomersRouter(env: ApiEnv, storeId: string) {
  const router = Router();
  router.use("/admin", createAuthMiddleware(env, "ADMIN"));

  router.get("/admin/customers", async (req, res, next) => {
    try {
      const parsed = listQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        next(badRequest("Invalid query parameters", "INVALID_REQUEST"));
        return;
      }

      const customers = await customerService.listAdminCustomers(storeId, parsed.data);
      res.json(customers);
    } catch (error) {
      next(error);
    }
  });

  router.get("/admin/customers/:id", async (req, res, next) => {
    try {
      const params = idParamSchema.safeParse(req.params);
      if (!params.success) {
        next(badRequest("Invalid customer id", "INVALID_REQUEST"));
        return;
      }

      const customer = await customerService.getAdminCustomerById(storeId, params.data.id);
      res.json(customer);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
