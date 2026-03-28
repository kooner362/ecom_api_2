export const SYSTEM_QUEUE_NAME = "system";
export const SYSTEM_JOB_PING = "PING";

export const EVENTS_QUEUE_NAME = "events";
export const EVENT_JOB_INVENTORY_LOW = "INVENTORY_LOW";
export const EVENT_JOB_ORDER_PLACED = "ORDER_PLACED";
export const EVENT_JOB_SEND_EMAIL = "SEND_EMAIL";

export interface InventoryLowEventPayload {
  storeId: string;
  variantId: string;
  locationId: string;
  onHand: number;
  threshold: number;
}

export interface OrderPlacedEventPayload {
  storeId: string;
  orderId: string;
  orderNumber: string;
  customerId: string;
  totalCents: number;
  currency: string;
}

export type EmailRouteType =
  | "CUSTOMER_CONFIRMATION"
  | "PACKING"
  | "WAREHOUSE"
  | "SHIPPED_CONFIRMATION"
  | "DELIVERED_CONFIRMATION";

export interface SendEmailEventPayload {
  storeId: string;
  orderId: string;
  routeType: EmailRouteType;
  idempotencyKey: string;
  force?: boolean;
}
