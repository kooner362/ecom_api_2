import { prisma } from "@ecom/db";
import { loadApiEnv } from "@ecom/shared";
import { ensureSingleStore } from "./lib/store.js";
import { buildServer } from "./server.js";

async function main() {
  const env = loadApiEnv();
  const storeId = await ensureSingleStore(env);
  const { app, logger, systemQueue, eventsQueue } = buildServer(env, storeId);

  const server = app.listen(env.API_PORT);

  server.on("listening", () => {
    logger.info({ port: env.API_PORT, storeId }, "api server started");
  });

  server.on("error", (error) => {
    logger.fatal({ err: error }, "failed to start api server");
    process.exit(1);
  });

  let shuttingDown = false;

  const shutdown = async (signal: string) => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;

    logger.info({ signal }, "shutting down api server");

    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });

    await systemQueue.close();
    await eventsQueue.close();
    await prisma.$disconnect();

    logger.info("api server shutdown complete");
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
