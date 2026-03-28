import { Queue } from "bullmq";
import { prisma } from "@ecom/db";
import {
  EVENT_JOB_SEND_EMAIL,
  type EmailRouteType,
  type OrderPlacedEventPayload,
  type SendEmailEventPayload
} from "@ecom/shared";

const db = prisma as any;

interface LoggerLike {
  info?(obj: unknown, msg?: string): void;
  warn?(obj: unknown, msg?: string): void;
  error?(obj: unknown, msg?: string): void;
}

const ORDER_PLACED_ROUTE_TYPES: EmailRouteType[] = ["CUSTOMER_CONFIRMATION", "PACKING", "WAREHOUSE"];

function createOrderRouteIdempotencyKey(orderId: string, routeType: EmailRouteType) {
  return `order_${orderId}_route_${routeType}`;
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "P2002";
}

export async function processOrderPlacedEvent(
  payload: OrderPlacedEventPayload,
  eventsQueue: Queue,
  logger: LoggerLike
) {
  const routes = await db.emailRoute.findMany({
    where: {
      storeId: payload.storeId,
      enabled: true,
      type: {
        in: ORDER_PLACED_ROUTE_TYPES
      }
    },
    select: {
      type: true
    }
  });

  for (const route of routes) {
    const routeType = route.type as EmailRouteType;
    const idempotencyKey = createOrderRouteIdempotencyKey(payload.orderId, routeType);

    try {
      await db.emailLog.create({
        data: {
          storeId: payload.storeId,
          orderId: payload.orderId,
          routeType,
          status: "QUEUED",
          to: { to: [], cc: [], bcc: [] },
          idempotencyKey
        }
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        logger.info?.({ orderId: payload.orderId, routeType }, "email job already queued/sent, skipping");
        continue;
      }

      throw error;
    }

    const sendPayload: SendEmailEventPayload = {
      storeId: payload.storeId,
      orderId: payload.orderId,
      routeType,
      idempotencyKey
    };

    await eventsQueue.add(EVENT_JOB_SEND_EMAIL, sendPayload, {
      jobId: idempotencyKey,
      removeOnComplete: true,
      attempts: 5,
      backoff: {
        type: "exponential",
        delay: 2000
      }
    });
  }
}
