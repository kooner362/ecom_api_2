import express, { type ErrorRequestHandler } from "express";
import { Queue } from "bullmq";
import { ZodError } from "zod";
import { createRequestLogger, createLogger, type ApiEnv, EVENTS_QUEUE_NAME, SYSTEM_QUEUE_NAME } from "@ecom/shared";
import { AppError } from "./lib/errors.js";
import { healthRouter } from "./routes/health.js";
import { createAdminJobsRouter } from "./routes/adminJobs.js";
import { createAdminAuthRouter } from "./routes/adminAuth.js";
import { createStoreAuthRouter } from "./routes/storeAuth.js";
import { createAdminCategoriesRouter } from "./routes/adminCategories.js";
import { createAdminProductsRouter } from "./routes/adminProducts.js";
import { createStoreCatalogRouter } from "./routes/storeCatalog.js";
import { createAdminInventoryRouter } from "./routes/adminInventory.js";
import { createAdminSettingsShippingRouter } from "./routes/adminSettingsShipping.js";
import { createAdminTaxRatesRouter } from "./routes/adminTaxRates.js";
import { createStoreCheckoutConfigRouter } from "./routes/storeCheckoutConfig.js";
import { createAdminDiscountsCategoryRouter } from "./routes/adminDiscountsCategory.js";
import { createAdminDiscountsCouponsRouter } from "./routes/adminDiscountsCoupons.js";
import { createStoreCouponsRouter } from "./routes/storeCoupons.js";
import { createStoreAddressesRouter } from "./routes/storeAddresses.js";
import { createStoreCartRouter } from "./routes/storeCart.js";
import { createStoreCheckoutRouter } from "./routes/storeCheckout.js";
import { createStoreOrdersRouter } from "./routes/storeOrders.js";
import { createAdminOrdersRouter } from "./routes/adminOrders.js";
import { createAdminRefundsReturnsRouter } from "./routes/adminRefundsReturns.js";
import { createAdminEmailSettingsRouter } from "./routes/adminEmailSettings.js";
import { createAdminOrderEmailsRouter } from "./routes/adminOrderEmails.js";
import { createAdminCustomersRouter } from "./routes/adminCustomers.js";
import { createAdminFaqsRouter } from "./routes/adminFaqs.js";
import { createAdminThemeRouter } from "./routes/adminTheme.js";
import { createAdminSettingsPaymentsRouter } from "./routes/adminSettingsPayments.js";
import { createStoreContentRouter } from "./routes/storeContent.js";
import { createAdminSettingsStoreRouter } from "./routes/adminSettingsStore.js";
import { createStorePaymentsRouter } from "./routes/storePayments.js";
import { createAdminReportsRouter } from "./routes/adminReports.js";
import { createAdminUploadsRouter } from "./routes/adminUploads.js";
import path from "node:path";
import fs from "node:fs";

export function buildServer(env: ApiEnv, storeId: string) {
  const app = express();
  const logger = createLogger(env.LOG_LEVEL, { service: "api" });

  const systemQueue = new Queue(SYSTEM_QUEUE_NAME, {
    connection: {
      url: env.REDIS_URL,
      maxRetriesPerRequest: null
    }
  });
  const eventsQueue = new Queue(EVENTS_QUEUE_NAME, {
    connection: {
      url: env.REDIS_URL,
      maxRetriesPerRequest: null
    }
  });

  // Serve uploaded files as static assets from /uploads
  const uploadsDir = path.resolve(env.UPLOADS_DIR);
  fs.mkdirSync(uploadsDir, { recursive: true });
  app.use("/uploads", express.static(uploadsDir));

  app.use(express.json());
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", req.header("origin") || "*");
    res.header("Vary", "Origin");
    res.header("Access-Control-Allow-Credentials", "true");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.header("Access-Control-Allow-Methods", "GET,POST,PATCH,PUT,DELETE,OPTIONS");

    if (req.method === "OPTIONS") {
      res.sendStatus(204);
      return;
    }

    next();
  });
  app.use(createRequestLogger(env.LOG_LEVEL, "api"));

  app.use(healthRouter);
  app.use(createAdminAuthRouter(env, storeId));
  app.use(createStoreAuthRouter(env, storeId));
  app.use(createAdminCategoriesRouter(env, storeId));
  app.use(createAdminProductsRouter(env, storeId));
  app.use(createAdminInventoryRouter(eventsQueue, env, storeId));
  app.use(createAdminSettingsShippingRouter(env, storeId));
  app.use(createAdminTaxRatesRouter(env, storeId));
  app.use(createAdminDiscountsCategoryRouter(env, storeId));
  app.use(createAdminDiscountsCouponsRouter(env, storeId));
  app.use(createAdminOrdersRouter(eventsQueue, env, storeId));
  app.use(createAdminRefundsReturnsRouter(env, storeId));
  app.use(createAdminEmailSettingsRouter(env, storeId));
  app.use(createAdminOrderEmailsRouter(eventsQueue, env, storeId));
  app.use(createAdminCustomersRouter(env, storeId));
  app.use(createAdminReportsRouter(env, storeId));
  app.use(createAdminFaqsRouter(env, storeId));
  app.use(createAdminThemeRouter(env, storeId));
  app.use(createAdminSettingsPaymentsRouter(env, storeId));
  app.use(createAdminSettingsStoreRouter(env, storeId));
  app.use(createAdminUploadsRouter(env, storeId));
  app.use(createStoreCatalogRouter(storeId));
  app.use(createStoreContentRouter(storeId));
  app.use(createStorePaymentsRouter(env, storeId));
  app.use(createStoreAddressesRouter(env, storeId));
  app.use(createStoreCartRouter(eventsQueue, env, storeId));
  app.use(createStoreCheckoutRouter(eventsQueue, env, storeId));
  app.use(createStoreOrdersRouter(env, storeId));
  app.use(createStoreCheckoutConfigRouter(env, storeId));
  app.use(createStoreCouponsRouter(env, storeId));
  app.use(createAdminJobsRouter(systemQueue, env));

  const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
    const requestId = typeof res.locals.requestId === "string" ? res.locals.requestId : undefined;

    if (error instanceof ZodError) {
      res.status(400).json({
        error: {
          code: "INVALID_REQUEST",
          message: "Invalid request body"
        },
        requestId
      });
      return;
    }

    if (error instanceof AppError) {
      res.status(error.status).json({
        error: {
          code: error.code,
          message: error.message
        },
        requestId
      });
      return;
    }

    const err = error as Error;
    logger.error({ err, requestId }, "request failed");
    res.status(500).json({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Unexpected server error"
      },
      requestId
    });
  };

  app.use(errorHandler);

  return {
    app,
    logger,
    systemQueue,
    eventsQueue
  };
}
