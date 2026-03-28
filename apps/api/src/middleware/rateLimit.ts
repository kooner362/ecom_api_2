import type { RequestHandler } from "express";
import { AppError } from "../lib/errors.js";

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export function createInMemoryRateLimiter(maxRequests: number, windowMs: number): RequestHandler {
  return (req, _res, next) => {
    const key = `${req.path}:${req.ip || "unknown"}`;
    const now = Date.now();
    const current = buckets.get(key);

    if (!current || current.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }

    if (current.count >= maxRequests) {
      next(new AppError(429, "RATE_LIMITED", "Too many attempts. Please try again later."));
      return;
    }

    current.count += 1;
    next();
  };
}
