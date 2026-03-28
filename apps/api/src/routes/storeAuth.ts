import { Router } from "express";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import { prisma } from "@ecom/db";
import { z } from "zod";
import type { ApiEnv } from "@ecom/shared";
import { badRequest, unauthorized } from "../lib/errors.js";
import { signAccessToken } from "../lib/jwt.js";
import { hashPassword, verifyPassword } from "../lib/password.js";
import { createAuthMiddleware } from "../middleware/auth.js";
import { createInMemoryRateLimiter } from "../middleware/rateLimit.js";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).max(100).optional()
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

function toExpiryDate(ttlSeconds: number) {
  return new Date(Date.now() + ttlSeconds * 1000);
}

export function createStoreAuthRouter(env: ApiEnv, storeId: string) {
  const router = Router();
  const rateLimitLogin = createInMemoryRateLimiter(5, 60_000);
  const requireCustomerAuth = createAuthMiddleware(env, "CUSTOMER");
  const customerTtlSeconds = env.CUSTOMER_SESSION_TTL_SECONDS;

  router.post("/store/auth/register", async (req, res, next) => {
    try {
      const parsed = registerSchema.safeParse(req.body);
      if (!parsed.success) {
        next(badRequest("Invalid request body", "INVALID_REQUEST"));
        return;
      }

      const email = parsed.data.email.toLowerCase();
      const passwordHash = await hashPassword(parsed.data.password);

      const customer = await prisma.customer.create({
        data: {
          storeId,
          email,
          passwordHash,
          name: parsed.data.name
        }
      });

      const session = await prisma.session.create({
        data: {
          storeId,
          actorType: "CUSTOMER",
          customerId: customer.id,
          expiresAt: toExpiryDate(customerTtlSeconds)
        }
      });

      const accessToken = signAccessToken(
        {
          sid: session.id,
          sub: customer.id,
          storeId,
          actorType: "CUSTOMER",
          roles: ["customer"]
        },
        env,
        customerTtlSeconds
      );

      res.status(201).json({
        accessToken,
        tokenType: "Bearer",
        expiresIn: customerTtlSeconds
      });
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError && error.code === "P2002") {
        next(badRequest("Unable to register with provided credentials", "REGISTRATION_FAILED"));
        return;
      }
      next(error);
    }
  });

  router.post("/store/auth/login", rateLimitLogin, async (req, res, next) => {
    try {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) {
        next(badRequest("Invalid request body", "INVALID_REQUEST"));
        return;
      }

      const email = parsed.data.email.toLowerCase();
      const customer = await prisma.customer.findUnique({
        where: {
          storeId_email: {
            storeId,
            email
          }
        }
      });

      const passwordValid = customer ? await verifyPassword(customer.passwordHash, parsed.data.password) : false;
      if (!customer || !passwordValid) {
        next(unauthorized("Invalid email or password", "INVALID_CREDENTIALS"));
        return;
      }

      const session = await prisma.session.create({
        data: {
          storeId,
          actorType: "CUSTOMER",
          customerId: customer.id,
          expiresAt: toExpiryDate(customerTtlSeconds)
        }
      });

      const accessToken = signAccessToken(
        {
          sid: session.id,
          sub: customer.id,
          storeId,
          actorType: "CUSTOMER",
          roles: ["customer"]
        },
        env,
        customerTtlSeconds
      );

      res.json({
        accessToken,
        tokenType: "Bearer",
        expiresIn: customerTtlSeconds
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/store/auth/logout", requireCustomerAuth, async (req, res, next) => {
    try {
      if (!req.auth) {
        next(unauthorized());
        return;
      }

      await prisma.session.updateMany({
        where: {
          id: req.auth.sessionId,
          actorType: "CUSTOMER",
          customerId: req.auth.userId,
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

  router.get("/store/me", requireCustomerAuth, async (req, res, next) => {
    try {
      if (!req.auth) {
        next(unauthorized());
        return;
      }

      const customer = await prisma.customer.findUnique({
        where: { id: req.auth.userId },
        select: { id: true, email: true, name: true, storeId: true, createdAt: true }
      });

      if (!customer) {
        next(unauthorized());
        return;
      }

      res.json(customer);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
