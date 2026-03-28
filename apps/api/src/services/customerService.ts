import { prisma } from "@ecom/db";
import { badRequest } from "../lib/errors.js";

const db = prisma as any;

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

function normalizePagination(input: { page?: number; limit?: number }) {
  const page = Math.max(1, input.page ?? 1);
  const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, input.limit ?? DEFAULT_PAGE_SIZE));
  return {
    page,
    limit,
    skip: (page - 1) * limit,
    take: limit
  };
}

function mapCustomerBase(customer: any) {
  const totalSpentCents = customer.orders.reduce((sum: number, order: any) => sum + (order.totalCents || 0), 0);
  const primaryAddress = customer.addresses[0];

  return {
    id: customer.id,
    name: customer.name || customer.email.split("@")[0],
    email: customer.email,
    phone: primaryAddress?.phone || null,
    totalOrders: customer._count.orders,
    totalSpentCents,
    joinedAt: customer.createdAt,
    address: primaryAddress
      ? {
          line1: primaryAddress.line1,
          line2: primaryAddress.line2,
          city: primaryAddress.city,
          province: primaryAddress.province,
          country: primaryAddress.country,
          postalCode: primaryAddress.postalCode
        }
      : null
  };
}

export const customerService = {
  async listAdminCustomers(
    storeId: string,
    input: {
      q?: string;
      page?: number;
      limit?: number;
    }
  ) {
    const { page, limit, skip, take } = normalizePagination(input);
    const where: any = {
      storeId,
      ...(input.q
        ? {
            OR: [
              { email: { contains: input.q, mode: "insensitive" } },
              { name: { contains: input.q, mode: "insensitive" } }
            ]
          }
        : {})
    };

    const [customers, total] = await Promise.all([
      db.customer.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip,
        take,
        include: {
          _count: {
            select: { orders: true }
          },
          orders: {
            select: { totalCents: true }
          },
          addresses: {
            where: { storeId },
            orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
            take: 1,
            select: {
              line1: true,
              line2: true,
              city: true,
              province: true,
              country: true,
              postalCode: true,
              phone: true
            }
          }
        }
      }),
      db.customer.count({ where })
    ]);

    return {
      items: customers.map(mapCustomerBase),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit))
      }
    };
  },

  async getAdminCustomerById(storeId: string, id: string) {
    const customer = await db.customer.findFirst({
      where: { storeId, id },
      include: {
        _count: {
          select: { orders: true }
        },
        orders: {
          orderBy: [{ placedAt: "desc" }, { id: "desc" }],
          take: 20,
          select: {
            id: true,
            orderNumber: true,
            totalCents: true,
            paymentStatus: true,
            fulfillmentStatus: true,
            placedAt: true
          }
        },
        addresses: {
          where: { storeId },
          orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
          select: {
            id: true,
            name: true,
            line1: true,
            line2: true,
            city: true,
            province: true,
            country: true,
            postalCode: true,
            phone: true,
            isDefault: true,
            createdAt: true
          }
        }
      }
    });

    if (!customer) {
      throw badRequest("Customer not found", "CUSTOMER_NOT_FOUND");
    }

    const base = mapCustomerBase(customer);
    return {
      ...base,
      orders: customer.orders.map((order: any) => ({
        id: order.id,
        orderNumber: order.orderNumber,
        totalCents: order.totalCents,
        paymentStatus: order.paymentStatus,
        fulfillmentStatus: order.fulfillmentStatus,
        placedAt: order.placedAt
      })),
      addresses: customer.addresses
    };
  }
};
