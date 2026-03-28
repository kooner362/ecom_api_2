import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { z } from "zod";

let envLoaded = false;

function loadDotEnv() {
  if (envLoaded) {
    return;
  }

  const candidates = [path.resolve(process.cwd(), ".env"), path.resolve(process.cwd(), "../../.env")];

  for (const filePath of candidates) {
    if (fs.existsSync(filePath)) {
      dotenv.config({ path: filePath });
      break;
    }
  }

  envLoaded = true;
}

const baseEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  REDIS_URL: z.string().url("REDIS_URL must be a valid URL")
});

const apiEnvSchema = baseEnvSchema.extend({
  API_PORT: z.coerce.number().int().positive().default(3000),
  JWT_ACCESS_SECRET: z.string().min(32, "JWT_ACCESS_SECRET must be at least 32 characters"),
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  CUSTOMER_SESSION_TTL_SECONDS: z.coerce.number().int().positive().default(60 * 60 * 24 * 30),
  ADMIN_SESSION_TTL_SECONDS: z.coerce.number().int().positive().default(60 * 60 * 24 * 30),
  APP_ENCRYPTION_KEY: z.string().min(32, "APP_ENCRYPTION_KEY must be at least 32 characters"),
  STRIPE_SECRET_KEY: z.string().min(1).optional(),
  APP_EMAIL_FROM: z.string().email().optional(),
  RESEND_API_KEY: z.string().min(1).optional(),
  SMTP_HOST: z.string().min(1).optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  SMTP_SECURE: z.coerce.boolean().optional(),
  SMTP_USER: z.string().min(1).optional(),
  SMTP_PASS: z.string().min(1).optional(),
  DEFAULT_STORE_NAME: z.string().min(1).default("Default Store"),
  ADMIN_BOOTSTRAP_EMAIL: z.string().email().optional(),
  ADMIN_BOOTSTRAP_PASSWORD: z.string().min(8).optional(),
  UPLOADS_DIR: z.string().min(1).default("./uploads"),
  API_PUBLIC_URL: z.string().url().default("http://localhost:3000")
});

const workerEnvSchema = baseEnvSchema.extend({
  APP_EMAIL_FROM: z.string().email("APP_EMAIL_FROM must be a valid email address"),
  APP_ENCRYPTION_KEY: z.string().min(32, "APP_ENCRYPTION_KEY must be at least 32 characters").optional(),
  RESEND_API_KEY: z.string().min(1).optional(),
  SMTP_HOST: z.string().min(1).optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  SMTP_SECURE: z.coerce.boolean().optional(),
  SMTP_USER: z.string().min(1).optional(),
  SMTP_PASS: z.string().min(1).optional()
});

function formatZodErrors(error: z.ZodError): string {
  return error.issues.map((issue) => `${issue.path.join(".") || "env"}: ${issue.message}`).join("\n");
}

function parseEnv<T extends z.ZodTypeAny>(schema: T, serviceName: string): z.infer<T> {
  loadDotEnv();

  const parsed = schema.safeParse(process.env);

  if (!parsed.success) {
    throw new Error(`Invalid environment configuration for ${serviceName}:\n${formatZodErrors(parsed.error)}`);
  }

  return parsed.data;
}

export function loadApiEnv() {
  return parseEnv(apiEnvSchema, "api");
}

export function loadWorkerEnv() {
  return parseEnv(workerEnvSchema, "worker");
}

export type ApiEnv = z.infer<typeof apiEnvSchema>;
export type WorkerEnv = z.infer<typeof workerEnvSchema>;
