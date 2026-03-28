import jwt from "jsonwebtoken";
import { type ApiEnv } from "@ecom/shared";

export type AuthActorType = "ADMIN" | "CUSTOMER";

export interface AccessTokenPayload {
  sid: string;
  sub: string;
  storeId: string;
  actorType: AuthActorType;
  roles: string[];
}

export function signAccessToken(payload: AccessTokenPayload, env: ApiEnv, ttlSeconds = env.JWT_ACCESS_TTL_SECONDS): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    algorithm: "HS256",
    expiresIn: ttlSeconds
  });
}

export function verifyAccessToken(token: string, env: ApiEnv): AccessTokenPayload {
  const payload = jwt.verify(token, env.JWT_ACCESS_SECRET, {
    algorithms: ["HS256"]
  });

  if (typeof payload !== "object" || payload === null) {
    throw new Error("Invalid token payload");
  }

  const typed = payload as Partial<AccessTokenPayload>;

  if (
    typeof typed.sid !== "string" ||
    typeof typed.sub !== "string" ||
    typeof typed.storeId !== "string" ||
    (typed.actorType !== "ADMIN" && typed.actorType !== "CUSTOMER") ||
    !Array.isArray(typed.roles)
  ) {
    throw new Error("Invalid token claims");
  }

  return {
    sid: typed.sid,
    sub: typed.sub,
    storeId: typed.storeId,
    actorType: typed.actorType,
    roles: typed.roles
  };
}
