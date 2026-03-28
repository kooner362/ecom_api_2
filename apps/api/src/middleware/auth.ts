import type { NextFunction, Request, Response } from "express";
import { prisma } from "@ecom/db";
import type { ApiEnv } from "@ecom/shared";
import { unauthorized, forbidden } from "../lib/errors.js";
import { verifyAccessToken, type AccessTokenPayload, type AuthActorType } from "../lib/jwt.js";

export interface AuthContext {
  sessionId: string;
  storeId: string;
  actorType: AuthActorType;
  userId: string;
  email: string;
  roles: string[];
}

function extractBearerToken(req: Request): string | null {
  const header = req.header("authorization");
  if (!header) {
    return null;
  }

  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  return token;
}

async function resolveSession(payload: AccessTokenPayload): Promise<AuthContext | null> {
  const session = await prisma.session.findUnique({
    where: { id: payload.sid },
    include: {
      adminUser: true,
      customer: true
    }
  });

  if (!session || session.revokedAt || session.expiresAt <= new Date()) {
    return null;
  }

  if (session.storeId !== payload.storeId || session.actorType !== payload.actorType) {
    return null;
  }

  if (payload.actorType === "ADMIN") {
    if (!session.adminUser || session.adminUser.id !== payload.sub) {
      return null;
    }

    return {
      sessionId: session.id,
      storeId: session.storeId,
      actorType: "ADMIN",
      userId: session.adminUser.id,
      email: session.adminUser.email,
      roles: payload.roles
    };
  }

  if (!session.customer || session.customer.id !== payload.sub) {
    return null;
  }

  return {
    sessionId: session.id,
    storeId: session.storeId,
    actorType: "CUSTOMER",
    userId: session.customer.id,
    email: session.customer.email,
    roles: payload.roles
  };
}

export function createAuthMiddleware(env: ApiEnv, requiredActor?: AuthActorType) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const token = extractBearerToken(req);
      if (!token) {
        next(unauthorized());
        return;
      }

      const payload = verifyAccessToken(token, env);
      const context = await resolveSession(payload);

      if (!context) {
        next(unauthorized("Invalid or expired token", "INVALID_TOKEN"));
        return;
      }

      if (requiredActor && context.actorType !== requiredActor) {
        next(forbidden());
        return;
      }

      req.auth = context;
      next();
    } catch {
      next(unauthorized("Invalid or expired token", "INVALID_TOKEN"));
    }
  };
}
