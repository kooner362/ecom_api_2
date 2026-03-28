import { Queue } from "bullmq";
import {
  EVENT_JOB_SEND_EMAIL,
  type EmailRouteType,
  type SendEmailEventPayload
} from "@ecom/shared";

function buildIdempotencyKey(orderId: string, routeType: EmailRouteType, suffix?: string) {
  if (suffix) {
    return `order_${orderId}_route_${routeType}_${suffix}`;
  }

  return `order_${orderId}_route_${routeType}`;
}

export function createEmailSendService(eventsQueue: Queue) {
  return {
    buildOrderPlacedIdempotencyKey(orderId: string, routeType: EmailRouteType) {
      return buildIdempotencyKey(orderId, routeType);
    },

    buildResendIdempotencyKey(orderId: string, routeType: EmailRouteType) {
      return buildIdempotencyKey(orderId, routeType, `${Date.now()}`);
    },

    async enqueueSendEmailJob(payload: SendEmailEventPayload) {
      await eventsQueue.add(EVENT_JOB_SEND_EMAIL, payload, {
        jobId: payload.idempotencyKey,
        removeOnComplete: true,
        attempts: 5,
        backoff: {
          type: "exponential",
          delay: 2000
        }
      });

      return {
        queued: true,
        idempotencyKey: payload.idempotencyKey
      };
    }
  };
}
