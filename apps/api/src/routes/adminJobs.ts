import { Router } from "express";
import { Queue } from "bullmq";
import { z } from "zod";
import type { ApiEnv } from "@ecom/shared";
import { SYSTEM_JOB_PING } from "@ecom/shared";
import { badRequest } from "../lib/errors.js";
import { createAuthMiddleware } from "../middleware/auth.js";

const pingJobSchema = z.object({
  payload: z.record(z.unknown()).optional()
});

export function createAdminJobsRouter(systemQueue: Queue, env: ApiEnv) {
  const router = Router();
  const requireAdminAuth = createAuthMiddleware(env, "ADMIN");

  router.post("/admin/jobs/ping", requireAdminAuth, async (req, res, next) => {
    try {
      const parsed = pingJobSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        next(badRequest("Invalid request body", "INVALID_REQUEST"));
        return;
      }

      const job = await systemQueue.add(SYSTEM_JOB_PING, parsed.data.payload ?? {}, {
        removeOnComplete: 100,
        removeOnFail: 100
      });

      res.status(202).json({
        ok: true,
        jobId: job.id
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
