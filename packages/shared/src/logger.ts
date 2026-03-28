import { randomUUID } from "node:crypto";
import pino, { type Logger, type LoggerOptions } from "pino";
import type { RequestHandler } from "express";

export function createLogger(level: string, bindings: Record<string, string> = {}): Logger {
  const options: LoggerOptions = {
    level,
    base: {
      ...bindings
    }
  };

  return pino(options);
}

export function createRequestLogger(level: string, service: string): RequestHandler {
  const logger = createLogger(level, { service });

  return (req, res, next) => {
    const headerValue = req.header("x-request-id");
    const requestId = headerValue || randomUUID();
    res.setHeader("x-request-id", requestId);
    res.locals.requestId = requestId;

    const start = Date.now();

    res.on("finish", () => {
      logger.info(
        {
          requestId,
          method: req.method,
          path: req.originalUrl,
          statusCode: res.statusCode,
          durationMs: Date.now() - start
        },
        "request completed"
      );
    });

    next();
  };
}
