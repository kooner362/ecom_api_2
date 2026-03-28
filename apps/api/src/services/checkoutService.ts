import { Queue } from "bullmq";
import { prisma } from "@ecom/db";
import {
  EVENT_JOB_ORDER_PLACED,
  type ApiEnv,
  type OrderPlacedEventPayload
} from "@ecom/shared";
import { badRequest } from "../lib/errors.js";
import { discountService } from "./discountService.js";
import { shippingService } from "./shippingService.js";
import { taxService } from "./taxService.js";
import { loadPaymentProvider } from "../payments/paymentProvider.js";
import { inventoryAllocationService } from "./inventoryAllocationService.js";
import { orderService } from "./orderService.js";
import { decryptJson } from "../lib/crypto.js";

const db = prisma as any;

type Tx = any;
type ShippingMethodType = "FLAT_RATE" | "LOCAL_DELIVERY" | "PICKUP";

interface CheckoutInput {
  shippingMethodType: ShippingMethodType;
  shippingAddressId?: string;
  couponCode?: string;
}

interface CartVariantData {
  id: string;
  productId: string;
  title: string;
  sku: string | null;
  priceCents: number;
  categories: string[];
}

function normalizeCoupon(code?: string): string | undefined {
  if (!code) {
    return undefined;
  }

  const normalized = discountService.normalizeCouponCode(code);
  return normalized || undefined;
}

function parseShippingAmountCents(configJson: unknown): number {
  if (!configJson || typeof configJson !== "object") {
    return 0;
  }

  const amount = (configJson as Record<string, unknown>).amountCents;
  if (!Number.isInteger(amount) || (amount as number) < 0) {
    throw badRequest("Shipping method is missing valid amountCents", "INVALID_SHIPPING_CONFIG");
  }

  return amount as number;
}

function mapCart(cart: any) {
  return {
    id: cart.id,
    status: cart.status,
    createdAt: cart.createdAt,
    updatedAt: cart.updatedAt,
    items: cart.items.map((item: any) => ({
      id: item.id,
      variantId: item.variantId,
      quantity: item.quantity,
      variant: {
        id: item.variant.id,
        title: item.variant.title,
        sku: item.variant.sku,
        priceCents: item.variant.priceCents
      }
    }))
  };
}

async function getActiveCartWithItems(tx: Tx, storeId: string, customerId: string) {
  const cart = await tx.cart.findFirst({
    where: {
      storeId,
      customerId,
      status: "ACTIVE"
    },
    include: {
      items: {
        include: {
          variant: {
            include: {
              product: {
                include: {
                  categories: {
                    select: { categoryId: true }
                  }
                }
              }
            }
          }
        }
      }
    }
  });

  return cart;
}

async function ensureAddressForCheckout(
  tx: Tx,
  storeId: string,
  customerId: string,
  shippingMethodType: ShippingMethodType,
  shippingAddressId?: string
) {
  if (shippingMethodType === "PICKUP") {
    return null;
  }

  if (!shippingAddressId) {
    throw badRequest("shippingAddressId is required for this shipping method", "SHIPPING_ADDRESS_REQUIRED");
  }

  const address = await tx.address.findFirst({
    where: {
      id: shippingAddressId,
      storeId,
      customerId
    }
  });

  if (!address) {
    throw badRequest("Shipping address not found", "SHIPPING_ADDRESS_NOT_FOUND");
  }

  return address;
}

function extractCartVariants(cart: any) {
  const variantMap = new Map<string, CartVariantData>();

  for (const item of cart.items) {
    variantMap.set(item.variantId, {
      id: item.variant.id,
      productId: item.variant.productId,
      title: item.variant.title,
      sku: item.variant.sku,
      priceCents: item.variant.priceCents,
      categories: item.variant.product.categories.map((entry: any) => entry.categoryId)
    });
  }

  return variantMap;
}

async function computeCheckoutSummaryWithClient(
  tx: Tx,
  storeId: string,
  customerId: string,
  cart: any,
  input: CheckoutInput
) {
  if (!cart || !cart.items.length) {
    throw badRequest("Cart is empty", "CART_EMPTY");
  }

  const shippingAddress = await ensureAddressForCheckout(
    tx,
    storeId,
    customerId,
    input.shippingMethodType,
    input.shippingAddressId
  );

  const addressForMatching = shippingAddress
    ? {
        country: shippingAddress.country,
        province: shippingAddress.province,
        postalCode: shippingAddress.postalCode
      }
    : {};

  const shippingMethod = await shippingService.getEnabledShippingMethodByType(
    storeId,
    input.shippingMethodType,
    addressForMatching
  );
  const shippingCents = parseShippingAmountCents(shippingMethod.configJson);

  const variantMap = extractCartVariants(cart);
  const cartLines = cart.items.map((item: any) => {
    const variant = variantMap.get(item.variantId);
    if (!variant) {
      throw badRequest("Variant not found in cart", "VARIANT_NOT_FOUND");
    }

    return {
      lineId: item.id,
      categoryIds: variant.categories,
      subtotalCents: variant.priceCents * item.quantity
    };
  });

  const subtotalCents = cartLines.reduce((sum: number, line: any) => sum + line.subtotalCents, 0);
  const normalizedCoupon = normalizeCoupon(input.couponCode);

  const bestDiscount = await discountService.computeBestDiscountWithClient(
    tx,
    storeId,
    cartLines,
    normalizedCoupon,
    customerId
  );

  const taxBase = subtotalCents - bestDiscount.discountCents + shippingCents;
  const tax = await taxService.computeTax(storeId, addressForMatching, taxBase);

  const totalCents = subtotalCents - bestDiscount.discountCents + shippingCents + tax.taxCents;

  return {
    cart,
    shippingAddress,
    shippingMethod,
    subtotalCents,
    discount: bestDiscount,
    shippingCents,
    taxCents: tax.taxCents,
    appliedTaxRate: tax.appliedRate,
    totalCents,
    normalizedCoupon,
    variantMap
  };
}

async function getManualPaymentEmail(storeId: string, env: ApiEnv): Promise<string> {
  const setting = await db.paymentProviderSetting.findUnique({
    where: {
      storeId_provider: {
        storeId,
        provider: "OTHER"
      }
    },
    select: {
      configEncrypted: true
    }
  });

  if (!setting?.configEncrypted) {
    return "";
  }

  try {
    const config = decryptJson<{ manualPaymentEmail?: string }>(setting.configEncrypted, env.APP_ENCRYPTION_KEY);
    return (config.manualPaymentEmail || "").trim();
  } catch {
    return "";
  }
}

export function createCheckoutService(eventsQueue: Queue, env: ApiEnv) {
  return {
    async getOrCreateActiveCart(storeId: string, customerId: string) {
      const existing = await db.cart.findFirst({
        where: {
          storeId,
          customerId,
          status: "ACTIVE"
        },
        include: {
          items: {
            include: {
              variant: {
                select: { id: true, title: true, sku: true, priceCents: true }
              }
            },
            orderBy: [{ id: "asc" }]
          }
        }
      });

      if (existing) {
        return mapCart(existing);
      }

      const cart = await db.cart.create({
        data: {
          storeId,
          customerId,
          status: "ACTIVE"
        },
        include: {
          items: {
            include: {
              variant: {
                select: { id: true, title: true, sku: true, priceCents: true }
              }
            }
          }
        }
      });

      return mapCart(cart);
    },

    async addCartItem(storeId: string, customerId: string, variantId: string, quantity: number) {
      if (!Number.isInteger(quantity) || quantity <= 0) {
        throw badRequest("quantity must be a positive integer", "INVALID_REQUEST");
      }

      return db.$transaction(async (tx: Tx) => {
        const cart =
          (await tx.cart.findFirst({
            where: {
              storeId,
              customerId,
              status: "ACTIVE"
            }
          })) ??
          (await tx.cart.create({
            data: {
              storeId,
              customerId,
              status: "ACTIVE"
            }
          }));

        const variant = await tx.productVariant.findFirst({
          where: { id: variantId, storeId, isActive: true },
          select: { id: true }
        });
        if (!variant) {
          throw badRequest("Variant not found", "VARIANT_NOT_FOUND");
        }

        const existingItem = await tx.cartItem.findUnique({
          where: {
            cartId_variantId: {
              cartId: cart.id,
              variantId
            }
          }
        });

        if (existingItem) {
          await tx.cartItem.update({
            where: { id: existingItem.id },
            data: {
              quantity: existingItem.quantity + quantity
            }
          });
        } else {
          await tx.cartItem.create({
            data: {
              storeId,
              cartId: cart.id,
              variantId,
              quantity
            }
          });
        }

        const updatedCart = await tx.cart.findUnique({
          where: { id: cart.id },
          include: {
            items: {
              include: {
                variant: {
                  select: { id: true, title: true, sku: true, priceCents: true }
                }
              },
              orderBy: [{ id: "asc" }]
            }
          }
        });

        return mapCart(updatedCart);
      });
    },

    async updateCartItemQuantity(storeId: string, customerId: string, cartItemId: string, quantity: number) {
      if (!Number.isInteger(quantity) || quantity <= 0) {
        throw badRequest("quantity must be a positive integer", "INVALID_REQUEST");
      }

      return db.$transaction(async (tx: Tx) => {
        const cart = await tx.cart.findFirst({
          where: {
            storeId,
            customerId,
            status: "ACTIVE"
          }
        });

        if (!cart) {
          throw badRequest("Active cart not found", "CART_NOT_FOUND");
        }

        const item = await tx.cartItem.findFirst({
          where: {
            id: cartItemId,
            cartId: cart.id,
            storeId
          }
        });

        if (!item) {
          throw badRequest("Cart item not found", "CART_ITEM_NOT_FOUND");
        }

        await tx.cartItem.update({
          where: { id: item.id },
          data: { quantity }
        });

        const updatedCart = await tx.cart.findUnique({
          where: { id: cart.id },
          include: {
            items: {
              include: {
                variant: {
                  select: { id: true, title: true, sku: true, priceCents: true }
                }
              },
              orderBy: [{ id: "asc" }]
            }
          }
        });

        return mapCart(updatedCart);
      });
    },

    async removeCartItem(storeId: string, customerId: string, cartItemId: string) {
      return db.$transaction(async (tx: Tx) => {
        const cart = await tx.cart.findFirst({
          where: {
            storeId,
            customerId,
            status: "ACTIVE"
          }
        });

        if (!cart) {
          throw badRequest("Active cart not found", "CART_NOT_FOUND");
        }

        const item = await tx.cartItem.findFirst({
          where: {
            id: cartItemId,
            storeId,
            cartId: cart.id
          }
        });

        if (!item) {
          throw badRequest("Cart item not found", "CART_ITEM_NOT_FOUND");
        }

        await tx.cartItem.delete({ where: { id: item.id } });

        const updatedCart = await tx.cart.findUnique({
          where: { id: cart.id },
          include: {
            items: {
              include: {
                variant: {
                  select: { id: true, title: true, sku: true, priceCents: true }
                }
              },
              orderBy: [{ id: "asc" }]
            }
          }
        });

        return mapCart(updatedCart);
      });
    },

    async preview(storeId: string, customerId: string, input: CheckoutInput) {
      const cart = await getActiveCartWithItems(db, storeId, customerId);
      if (!cart) {
        throw badRequest("Active cart not found", "CART_NOT_FOUND");
      }

      const summary = await computeCheckoutSummaryWithClient(db, storeId, customerId, cart, input);

      return {
        subtotalCents: summary.subtotalCents,
        discountCents: summary.discount.discountCents,
        shippingCents: summary.shippingCents,
        taxCents: summary.taxCents,
        totalCents: summary.totalCents,
        appliedDiscount: {
          applied: summary.discount.applied,
          details: summary.discount.details
        },
        appliedTaxRate: summary.appliedTaxRate
      };
    },

    async createPaymentIntent(storeId: string, customerId: string, input: CheckoutInput) {
      const customer = await db.customer.findFirst({ where: { id: customerId, storeId } });
      if (!customer) {
        throw badRequest("Customer not found", "CUSTOMER_NOT_FOUND");
      }

      const cart = await getActiveCartWithItems(db, storeId, customerId);
      if (!cart) {
        throw badRequest("Active cart not found", "CART_NOT_FOUND");
      }

      const summary = await computeCheckoutSummaryWithClient(db, storeId, customerId, cart, input);
      if (summary.totalCents <= 0) {
        throw badRequest("Total amount must be greater than zero", "INVALID_TOTAL");
      }

      const provider = await loadPaymentProvider(storeId, env);
      const paymentIntent = await provider.createPaymentIntent({
        amountCents: summary.totalCents,
        currency: "CAD",
        cartId: cart.id,
        customerId,
        customerEmail: customer.email,
        metadata: {
          shippingMethodType: input.shippingMethodType,
          shippingAddressId: input.shippingAddressId ?? "",
          couponCode: summary.normalizedCoupon ?? ""
        }
      });

      return {
        clientSecret: paymentIntent.clientSecret,
        paymentIntentId: paymentIntent.providerPaymentIntentId,
        amountCents: paymentIntent.amountCents
      };
    },

    async confirm(
      storeId: string,
      customerId: string,
      input: CheckoutInput & {
        paymentIntentId: string;
      }
    ) {
      const provider = await loadPaymentProvider(storeId, env);
      const paymentIntent = await provider.verifyPaymentSucceeded(input.paymentIntentId);
      const manualPaymentEmail = paymentIntent.provider === "OTHER" ? await getManualPaymentEmail(storeId, env) : "";

      if (!paymentIntent.succeeded) {
        throw badRequest("Payment is not successful", "PAYMENT_NOT_SUCCEEDED");
      }

      const existingPayment = await db.payment.findUnique({
        where: { providerPaymentIntentId: input.paymentIntentId },
        include: { order: true }
      });

      if (existingPayment) {
        if (existingPayment.storeId !== storeId) {
          throw badRequest("Payment intent belongs to another store", "PAYMENT_INTENT_CONFLICT");
        }

        return orderService.getCustomerOrderById(storeId, customerId, existingPayment.orderId);
      }

      const confirmed = await db.$transaction(async (tx: Tx) => {
        const idempotentPayment = await tx.payment.findUnique({
          where: { providerPaymentIntentId: input.paymentIntentId }
        });
        if (idempotentPayment) {
          return { orderId: idempotentPayment.orderId, alreadyExisted: true };
        }

        const customer = await tx.customer.findFirst({ where: { id: customerId, storeId } });
        if (!customer) {
          throw badRequest("Customer not found", "CUSTOMER_NOT_FOUND");
        }

        const cart = await getActiveCartWithItems(tx, storeId, customerId);
        if (!cart) {
          throw badRequest("Active cart not found", "CART_NOT_FOUND");
        }

        const summary = await computeCheckoutSummaryWithClient(tx, storeId, customerId, cart, input);
        if (summary.totalCents !== paymentIntent.amountCents) {
          throw badRequest("Payment amount mismatch", "PAYMENT_AMOUNT_MISMATCH");
        }

        const orderNumber = await orderService.createOrderNumber(storeId);

        const order = await tx.order.create({
          data: {
            storeId,
            orderNumber,
            customerId,
            email: customer.email,
            shippingMethodType: input.shippingMethodType,
            shippingCents: summary.shippingCents,
            subtotalCents: summary.subtotalCents,
            discountCents: summary.discount.discountCents,
            taxCents: summary.taxCents,
            totalCents: summary.totalCents,
            currency: paymentIntent.currency,
            paymentStatus: "PAID",
            fulfillmentStatus: "UNFULFILLED",
            placedAt: new Date(),
            shippingAddressId: summary.shippingAddress?.id ?? null,
            billingAddressId: summary.shippingAddress?.id ?? null
          }
        });

        const createdOrderItems: Array<{ id: string; variantId: string; quantity: number }> = [];

        for (const cartItem of summary.cart.items) {
          const variant = summary.variantMap.get(cartItem.variantId);
          if (!variant) {
            throw badRequest("Variant not found in cart", "VARIANT_NOT_FOUND");
          }

          const createdOrderItem = await tx.orderItem.create({
            data: {
              storeId,
              orderId: order.id,
              variantId: variant.id,
              titleSnapshot: variant.title,
              skuSnapshot: variant.sku,
              unitPriceCents: variant.priceCents,
              quantity: cartItem.quantity,
              lineSubtotalCents: variant.priceCents * cartItem.quantity,
              returnStatus: "NONE"
            }
          });

          createdOrderItems.push({
            id: createdOrderItem.id,
            variantId: variant.id,
            quantity: cartItem.quantity
          });
        }

        await inventoryAllocationService.allocateSingleBestLocation(
          tx,
          storeId,
          createdOrderItems.map((item) => ({
            orderItemId: item.id,
            variantId: item.variantId,
            quantity: item.quantity
          }))
        );

        await tx.payment.create({
          data: {
            storeId,
            orderId: order.id,
            provider: paymentIntent.provider,
            providerPaymentIntentId: paymentIntent.providerPaymentIntentId,
            providerChargeId: paymentIntent.providerChargeId,
            amountCents: summary.totalCents,
            currency: paymentIntent.currency,
            status: "SUCCEEDED"
          }
        });

        if (summary.discount.applied === "COUPON" && summary.discount.details.coupon?.valid && summary.discount.details.coupon.coupon) {
          await tx.couponRedemption.create({
            data: {
              storeId,
              couponId: summary.discount.details.coupon.coupon.id,
              customerId,
              orderId: order.id
            }
          });
        }

        await tx.cart.update({
          where: { id: cart.id },
          data: {
            status: "CHECKED_OUT"
          }
        });

        await tx.orderEvent.create({
          data: {
            storeId,
            orderId: order.id,
            type: "ORDER_PLACED",
            metadata: {
              paymentIntentId: paymentIntent.providerPaymentIntentId,
              paymentProvider: paymentIntent.provider,
              manualPaymentEmail: manualPaymentEmail || null,
              shippingMethodType: input.shippingMethodType,
              couponCode: summary.normalizedCoupon ?? null
            }
          }
        });

        return { orderId: order.id, alreadyExisted: false, orderNumber: order.orderNumber, totalCents: summary.totalCents };
      });

      if (!confirmed.alreadyExisted) {
        const payload: OrderPlacedEventPayload = {
          storeId,
          orderId: confirmed.orderId,
          orderNumber: confirmed.orderNumber,
          customerId,
          totalCents: confirmed.totalCents,
          currency: paymentIntent.currency
        };

        await eventsQueue.add(EVENT_JOB_ORDER_PLACED, payload, {
          jobId: `order_placed_${storeId}_${confirmed.orderId}`,
          removeOnComplete: 1000,
          removeOnFail: 1000
        });
      }

      return orderService.getCustomerOrderById(storeId, customerId, confirmed.orderId);
    }
  };
}
