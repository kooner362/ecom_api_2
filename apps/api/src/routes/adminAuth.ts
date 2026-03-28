import { Router } from "express";
import { prisma } from "@ecom/db";
import { z } from "zod";
import type { ApiEnv } from "@ecom/shared";
import { badRequest, unauthorized } from "../lib/errors.js";
import { signAccessToken } from "../lib/jwt.js";
import { verifyPassword } from "../lib/password.js";
import { createAuthMiddleware } from "../middleware/auth.js";
import { createInMemoryRateLimiter } from "../middleware/rateLimit.js";

const adminLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

function toExpiryDate(ttlSeconds: number) {
  return new Date(Date.now() + ttlSeconds * 1000);
}

export function createAdminAuthRouter(env: ApiEnv, storeId: string) {
  const router = Router();
  const rateLimitLogin = createInMemoryRateLimiter(5, 60_000);
  const requireAdminAuth = createAuthMiddleware(env, "ADMIN");

  router.post("/admin/auth/login", rateLimitLogin, async (req, res, next) => {
    try {
      const parsed = adminLoginSchema.safeParse(req.body);
      if (!parsed.success) {
        next(badRequest("Invalid request body", "INVALID_REQUEST"));
        return;
      }

      const email = parsed.data.email.toLowerCase();
      const adminTtlSeconds = env.ADMIN_SESSION_TTL_SECONDS;
      const adminUser = await prisma.adminUser.findUnique({
        where: {
          storeId_email: {
            storeId,
            email
          }
        }
      });

      const passwordValid = adminUser ? await verifyPassword(adminUser.passwordHash, parsed.data.password) : false;
      if (!adminUser || !passwordValid) {
        next(unauthorized("Invalid email or password", "INVALID_CREDENTIALS"));
        return;
      }

      const session = await prisma.session.create({
        data: {
          storeId,
          actorType: "ADMIN",
          adminUserId: adminUser.id,
          expiresAt: toExpiryDate(adminTtlSeconds)
        }
      });

      const accessToken = signAccessToken(
        {
          sid: session.id,
          sub: adminUser.id,
          storeId,
          actorType: "ADMIN",
          roles: ["admin"]
        },
        env,
        adminTtlSeconds
      );

      res.json({
        accessToken,
        tokenType: "Bearer",
        expiresIn: adminTtlSeconds
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/admin/auth/logout", requireAdminAuth, async (req, res, next) => {
    try {
      if (!req.auth) {
        next(unauthorized());
        return;
      }

      await prisma.session.updateMany({
        where: {
          id: req.auth.sessionId,
          actorType: "ADMIN",
          adminUserId: req.auth.userId,
          revokedAt: null
        },
        data: {
          revokedAt: new Date()
        }
      });

      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  router.get("/admin/me", requireAdminAuth, async (req, res, next) => {
    try {
      if (!req.auth) {
        next(unauthorized());
        return;
      }

      res.json({
        id: req.auth.userId,
        email: req.auth.email,
        actorType: req.auth.actorType,
        roles: req.auth.roles,
        storeId: req.auth.storeId
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
