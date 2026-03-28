import { prisma } from "@ecom/db";
import type { ApiEnv } from "@ecom/shared";
import { badRequest } from "../lib/errors.js";
import { loadPaymentProvider } from "../payments/paymentProvider.js";

const db = prisma as any;

function mapOrder(order: any) {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    customerId: order.customerId,
    email: order.email,
    shippingMethodType: order.shippingMethodType,
    shippingCents: order.shippingCents,
    subtotalCents: order.subtotalCents,
    discountCents: order.discountCents,
    taxCents: order.taxCents,
    totalCents: order.totalCents,
    currency: order.currency,
    paymentStatus: order.paymentStatus,
    fulfillmentStatus: order.fulfillmentStatus,
    trackingNumber: order.trackingNumber,
    placedAt: order.placedAt,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    shippingAddress: order.shippingAddress,
    billingAddress: order.billingAddress,
    items: order.items?.map((item: any) => ({
      id: item.id,
      variantId: item.variantId,
      titleSnapshot: item.titleSnapshot,
      skuSnapshot: item.skuSnapshot,
      unitPriceCents: item.unitPriceCents,
      quantity: item.quantity,
      lineSubtotalCents: item.lineSubtotalCents,
      returnStatus: item.returnStatus,
      returnedAt: item.returnedAt,
      allocations: item.allocations?.map((allocation: any) => ({
        id: allocation.id,
        locationId: allocation.locationId,
        quantity: allocation.quantity
      }))
    })),
    payments: order.payments?.map((payment: any) => ({
      id: payment.id,
      provider: payment.provider,
      providerPaymentIntentId: payment.providerPaymentIntentId,
      providerChargeId: payment.providerChargeId,
      amountCents: payment.amountCents,
      currency: payment.currency,
      status: payment.status,
      createdAt: payment.createdAt
    })),
    refunds: order.refunds?.map((refund: any) => ({
      id: refund.id,
      provider: refund.provider,
      providerRefundId: refund.providerRefundId,
      amountCents: refund.amountCents,
      reason: refund.reason,
      status: refund.status,
      createdAt: refund.createdAt
    })),
    events: order.events?.map((event: any) => ({
      id: event.id,
      type: event.type,
      metadata: event.metadata,
      createdAt: event.createdAt,
      createdByAdminUserId: event.createdByAdminUserId
    }))
  };
}

const orderInclude = {
  shippingAddress: true,
  billingAddress: true,
  items: {
    include: {
      allocations: true
    },
    orderBy: [{ id: "asc" }]
  },
  payments: {
    orderBy: [{ createdAt: "desc" }]
  },
  refunds: {
    orderBy: [{ createdAt: "desc" }]
  },
  events: {
    orderBy: [{ createdAt: "asc" }]
  }
};

const allowedFulfillmentTransitions: Record<string, string[]> = {
  UNFULFILLED: ["PICKING", "CANCELED"],
  PICKING: ["PACKED", "CANCELED"],
  PACKED: ["SHIPPED", "CANCELED"],
  SHIPPED: ["DELIVERED"],
  DELIVERED: [],
  CANCELED: []
};

async function generateOrderNumber(storeId: string, attempt = 0) {
  const now = Date.now();
  const suffix = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, "0");
  const base = `${now}`.slice(-9);
  const withAttempt = `${base}${attempt.toString().padStart(2, "0")}${suffix}`;

  const existing = await db.order.findFirst({
    where: {
      storeId,
      orderNumber: withAttempt
    },
    select: { id: true }
  });

  if (!existing) {
    return withAttempt;
  }

  if (attempt >= 20) {
    throw badRequest("Failed to generate order number", "ORDER_NUMBER_GENERATION_FAILED");
  }

  return generateOrderNumber(storeId, attempt + 1);
}

export const orderService = {
  async createOrderNumber(storeId: string) {
    return generateOrderNumber(storeId);
  },

  async getCustomerOrders(storeId: string, customerId: string) {
    const items = await db.order.findMany({
      where: { storeId, customerId },
      include: orderInclude,
      orderBy: [{ placedAt: "desc" }, { id: "desc" }]
    });

    return { items: items.map(mapOrder) };
  },

  async getCustomerOrderById(storeId: string, customerId: string, id: string) {
    const order = await db.order.findFirst({
      where: { id, storeId, customerId },
      include: orderInclude
    });

    if (!order) {
      throw badRequest("Order not found", "ORDER_NOT_FOUND");
    }

    return mapOrder(order);
  },

  async getAdminOrders(
    storeId: string,
    filters: {
      paymentStatus?: string;
      fulfillmentStatus?: string;
      q?: string;
      page?: number;
      limit?: number;
    }
  ) {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(100, Math.max(1, filters.limit ?? 20));

    const where: any = {
      storeId,
      ...(filters.paymentStatus ? { paymentStatus: filters.paymentStatus } : {}),
      ...(filters.fulfillmentStatus ? { fulfillmentStatus: filters.fulfillmentStatus } : {}),
      ...(filters.q
        ? {
            OR: [
              { orderNumber: { contains: filters.q, mode: "insensitive" } },
              { email: { contains: filters.q, mode: "insensitive" } }
            ]
          }
        : {})
    };

    const [items, total] = await Promise.all([
      db.order.findMany({
        where,
        include: orderInclude,
        orderBy: [{ placedAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * limit,
        take: limit
      }),
      db.order.count({ where })
    ]);

    return {
      items: items.map(mapOrder),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit))
      }
    };
  },

  async getAdminOrderById(storeId: string, id: string) {
    const order = await db.order.findFirst({ where: { id, storeId }, include: orderInclude });
    if (!order) {
      throw badRequest("Order not found", "ORDER_NOT_FOUND");
    }
    return mapOrder(order);
  },

  async updateFulfillmentStatus(
    env: ApiEnv,
    storeId: string,
    id: string,
    fulfillmentStatus: string,
    trackingNumber?: string,
    createdByAdminUserId?: string
  ) {
    const order = await db.order.findFirst({
      where: { id, storeId },
      include: {
        payments: {
          where: { status: "SUCCEEDED" },
          orderBy: [{ createdAt: "desc" }],
          take: 1
        },
        refunds: {
          where: { status: "SUCCEEDED" }
        }
      }
    });
    if (!order) {
      throw badRequest("Order not found", "ORDER_NOT_FOUND");
    }

    const allowed = allowedFulfillmentTransitions[order.fulfillmentStatus] ?? [];
    if (!allowed.includes(fulfillmentStatus)) {
      throw badRequest("Invalid fulfillment status transition", "INVALID_FULFILLMENT_TRANSITION");
    }

    if (trackingNumber !== undefined && fulfillmentStatus !== "SHIPPED") {
      throw badRequest("Tracking number can only be set when marking order as SHIPPED", "INVALID_REQUEST");
    }

    const normalizedTrackingNumber =
      trackingNumber === undefined ? undefined : trackingNumber.trim() ? trackingNumber.trim() : null;

    // If cancellation is requested for a paid Stripe order, refund remaining
    // amount before marking fulfillment as canceled.
    if (fulfillmentStatus === "CANCELED") {
      const successfulPayment = order.payments?.[0];
      const alreadyRefunded = (order.refunds || []).reduce((sum: number, item: any) => sum + item.amountCents, 0);
      const remaining = Math.max(0, order.totalCents - alreadyRefunded);
      const hasRefundableAmount =
        remaining > 0 && (order.paymentStatus === "PAID" || order.paymentStatus === "PARTIALLY_REFUNDED");

      if (hasRefundableAmount && successfulPayment?.provider === "STRIPE") {
        await this.createRefund(env, storeId, order.id, remaining, "Order canceled", createdByAdminUserId);
      }
    }

    const updated = await db.$transaction(async (tx: any) => {
      const nextOrder = await tx.order.update({
        where: { id: order.id },
        data: {
          fulfillmentStatus,
          ...(normalizedTrackingNumber !== undefined ? { trackingNumber: normalizedTrackingNumber } : {})
        }
      });

      await tx.orderEvent.create({
        data: {
          storeId,
          orderId: order.id,
          type: `FULFILLMENT_${fulfillmentStatus}`,
          metadata: {
            from: order.fulfillmentStatus,
            to: fulfillmentStatus,
            ...(normalizedTrackingNumber !== undefined ? { trackingNumber: normalizedTrackingNumber } : {})
          },
          createdByAdminUserId
        }
      });

      return nextOrder;
    });

    return this.getAdminOrderById(storeId, updated.id);
  },

  async createRefund(
    env: ApiEnv,
    storeId: string,
    orderId: string,
    amountCents: number,
    reason: string | undefined,
    createdByAdminUserId?: string
  ) {
    const order = await db.order.findFirst({
      where: { id: orderId, storeId },
      include: {
        payments: {
          where: { status: "SUCCEEDED" },
          orderBy: [{ createdAt: "desc" }],
          take: 1
        },
        refunds: {
          where: { status: "SUCCEEDED" }
        }
      }
    });

    if (!order) {
      throw badRequest("Order not found", "ORDER_NOT_FOUND");
    }

    if (!order.payments.length) {
      throw badRequest("Order has no successful payment", "PAYMENT_NOT_FOUND");
    }

    const successfulRefunded = order.refunds.reduce((sum: number, item: any) => sum + item.amountCents, 0);
    const remaining = Math.max(0, order.totalCents - successfulRefunded);

    if (amountCents <= 0 || amountCents > remaining) {
      throw badRequest("Invalid refund amount", "INVALID_REFUND_AMOUNT");
    }

    const payment = order.payments[0];
    const provider = await loadPaymentProvider(storeId, env, payment.provider);
    const providerRefund = await provider.createRefund({
      providerPaymentIntentId: payment.providerPaymentIntentId,
      amountCents,
      reason
    });

    await db.$transaction(async (tx: any) => {
      await tx.refund.create({
        data: {
          storeId,
          orderId: order.id,
          provider: payment.provider,
          providerRefundId: providerRefund.providerRefundId,
          amountCents,
          reason,
          status: providerRefund.status
        }
      });

      let nextPaymentStatus = order.paymentStatus;
      if (providerRefund.status === "SUCCEEDED") {
        const newTotalRefunded = successfulRefunded + amountCents;
        nextPaymentStatus = newTotalRefunded >= order.totalCents ? "REFUNDED" : "PARTIALLY_REFUNDED";
      }

      await tx.order.update({
        where: { id: order.id },
        data: {
          paymentStatus: nextPaymentStatus
        }
      });

      await tx.orderEvent.create({
        data: {
          storeId,
          orderId: order.id,
          type: "REFUND_CREATED",
          metadata: {
            amountCents,
            reason,
            providerRefundId: providerRefund.providerRefundId,
            status: providerRefund.status
          },
          createdByAdminUserId
        }
      });
    });

    return this.getAdminOrderById(storeId, order.id);
  },

  async markItemsReturned(
    storeId: string,
    orderId: string,
    orderItemIds: string[],
    createdByAdminUserId?: string
  ) {
    const order = await db.order.findFirst({
      where: { id: orderId, storeId },
      include: { items: true }
    });

    if (!order) {
      throw badRequest("Order not found", "ORDER_NOT_FOUND");
    }

    const existingItemIds = new Set(order.items.map((item: any) => item.id));
    for (const orderItemId of orderItemIds) {
      if (!existingItemIds.has(orderItemId)) {
        throw badRequest(`Order item ${orderItemId} not found`, "ORDER_ITEM_NOT_FOUND");
      }
    }

    const returnedAt = new Date();
    await db.$transaction(async (tx: any) => {
      await tx.orderItem.updateMany({
        where: {
          storeId,
          orderId,
          id: { in: orderItemIds }
        },
        data: {
          returnStatus: "RETURNED",
          returnedAt
        }
      });

      await tx.orderEvent.create({
        data: {
          storeId,
          orderId,
          type: "ITEM_RETURNED",
          metadata: {
            orderItemIds,
            policy: "simple-full-item-return"
          },
          createdByAdminUserId
        }
      });
    });

    return this.getAdminOrderById(storeId, orderId);
  }
};
