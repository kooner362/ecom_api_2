import { Queue, Worker } from "bullmq";
import { prisma } from "@ecom/db";
import {
  loadWorkerEnv,
  createLogger,
  SYSTEM_JOB_PING,
  SYSTEM_QUEUE_NAME,
  EVENTS_QUEUE_NAME,
  EVENT_JOB_INVENTORY_LOW,
  EVENT_JOB_ORDER_PLACED,
  EVENT_JOB_SEND_EMAIL,
  type OrderPlacedEventPayload,
  type SendEmailEventPayload
} from "@ecom/shared";
import { processOrderPlacedEvent } from "./processors/orderPlaced.js";
import { processSendEmailEvent } from "./processors/sendEmail.js";

async function main() {
  const env = loadWorkerEnv();
  const logger = createLogger(env.LOG_LEVEL, { service: "worker" });
  const eventsQueue = new Queue(EVENTS_QUEUE_NAME, {
    connection: {
      url: env.REDIS_URL,
      maxRetriesPerRequest: null
    }
  });

  const systemWorker = new Worker(
    SYSTEM_QUEUE_NAME,
    async (job) => {
      if (job.name === SYSTEM_JOB_PING) {
        logger.info({ jobId: job.id, payload: job.data }, "processed PING job");
        return;
      }

      logger.warn({ jobName: job.name, jobId: job.id }, "received unknown system job");
    },
    {
      connection: {
        url: env.REDIS_URL,
        maxRetriesPerRequest: null
      }
    }
  );

  const eventsWorker = new Worker(
    EVENTS_QUEUE_NAME,
    async (job) => {
      if (job.name === EVENT_JOB_INVENTORY_LOW) {
        logger.warn({ jobId: job.id, payload: job.data }, "processed INVENTORY_LOW event");
        return;
      }

      if (job.name === EVENT_JOB_ORDER_PLACED) {
        await processOrderPlacedEvent(job.data as OrderPlacedEventPayload, eventsQueue, logger);
        logger.info({ jobId: job.id, payload: job.data }, "processed ORDER_PLACED event");
        return;
      }

      if (job.name === EVENT_JOB_SEND_EMAIL) {
        await processSendEmailEvent(job.data as SendEmailEventPayload, env, logger);
        logger.info({ jobId: job.id, payload: job.data }, "processed SEND_EMAIL event");
        return;
      }

      logger.warn({ jobName: job.name, jobId: job.id }, "received unknown events job");
    },
    {
      connection: {
        url: env.REDIS_URL,
        maxRetriesPerRequest: null
      }
    }
  );

  systemWorker.on("ready", () => {
    logger.info("system worker started");
  });
  eventsWorker.on("ready", () => {
    logger.info("events worker started");
  });

  systemWorker.on("failed", (job, error) => {
    logger.error({ jobId: job?.id, err: error }, "job failed");
  });
  eventsWorker.on("failed", (job, error) => {
    logger.error({ jobId: job?.id, err: error }, "job failed");
  });

  let shuttingDown = false;

  const shutdown = async (signal: string) => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;

    logger.info({ signal }, "shutting down worker");
    await systemWorker.close();
    await eventsWorker.close();
    await eventsQueue.close();
    await prisma.$disconnect();
    logger.info("worker shutdown complete");
    process.exit(0);
  };

  process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
  });

  process.on("SIGINT", () => {
    void shutdown("SIGINT");
  });
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});
