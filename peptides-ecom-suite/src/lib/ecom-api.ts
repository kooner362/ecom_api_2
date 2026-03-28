export const CUSTOMER_TOKEN_KEY = "fk_customer_token";
export const ADMIN_TOKEN_KEY = "fk_admin_token";

const API_BASE_URL = (import.meta.env.VITE_ECOM_API_URL || "http://localhost:3000").replace(/\/+$/, "");

type HttpMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
type Actor = "customer" | "admin";

class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

function getToken(actor: Actor): string | null {
  const key = actor === "admin" ? ADMIN_TOKEN_KEY : CUSTOMER_TOKEN_KEY;
  return localStorage.getItem(key);
}

function setToken(actor: Actor, token: string | null) {
  const key = actor === "admin" ? ADMIN_TOKEN_KEY : CUSTOMER_TOKEN_KEY;
  if (!token) {
    localStorage.removeItem(key);
    return;
  }
  localStorage.setItem(key, token);
}

async function request<T>(path: string, method: HttpMethod, body?: unknown, actor?: Actor): Promise<T> {
  const headers: Record<string, string> = {
    "content-type": "application/json"
  };

  if (actor) {
    const token = getToken(actor);
    if (token) {
      headers.authorization = `Bearer ${token}`;
    }
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });

  if (!response.ok) {
    let errorMessage = `Request failed with status ${response.status}`;
    let errorCode: string | undefined;
    try {
      const json = await response.json();
      if (json?.error?.message) {
        errorMessage = json.error.message;
      }
      errorCode = json?.error?.code;
    } catch {
      // keep generic message
    }
    if (actor && response.status === 401 && (errorCode === "INVALID_TOKEN" || errorCode === "UNAUTHORIZED")) {
      setToken(actor, null);
    }
    throw new ApiError(errorMessage, response.status, errorCode);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export const ecomApi = {
  baseUrl: API_BASE_URL,
  getToken,
  setToken,
  request,
  customer: {
    register(payload: { email: string; password: string; name?: string }) {
      return request<{ accessToken: string }>("/store/auth/register", "POST", payload);
    },
    login(payload: { email: string; password: string }) {
      return request<{ accessToken: string }>("/store/auth/login", "POST", payload);
    },
    logout() {
      return request<{ ok: true }>("/store/auth/logout", "POST", {}, "customer");
    },
    me() {
      return request<{ id: string; email: string; name?: string | null; createdAt: string }>(
        "/store/me",
        "GET",
        undefined,
        "customer"
      );
    }
  },
  admin: {
    // Keep email route literals centralized so admin settings can support all transactional types.
    emailRouteTypes: [
      "CUSTOMER_CONFIRMATION",
      "PACKING",
      "WAREHOUSE",
      "SHIPPED_CONFIRMATION",
      "DELIVERED_CONFIRMATION"
    ] as const,
    uploadFile(file: File): Promise<string> {
      const token = getToken("admin");
      const formData = new FormData();
      formData.append("file", file);
      return fetch(`${API_BASE_URL}/admin/uploads`, {
        method: "POST",
        headers: token ? { authorization: `Bearer ${token}` } : {},
        body: formData,
      })
        .then(async (res) => {
          if (!res.ok) {
            const json = await res.json().catch(() => ({}));
            throw new ApiError(json?.error?.message ?? "Upload failed", res.status, json?.error?.code);
          }
          return res.json() as Promise<{ url: string }>;
        })
        .then((data) => data.url);
    },
    login(payload: { email: string; password: string }) {
      return request<{ accessToken: string }>("/admin/auth/login", "POST", payload);
    },
    logout() {
      return request<{ ok: true }>("/admin/auth/logout", "POST", {}, "admin");
    },
    me() {
      return request<{ id: string; email: string }>("/admin/me", "GET", undefined, "admin");
    },
    categories() {
      return request<{ items: Array<{ id: string; name: string; slug: string; description?: string; sortOrder: number; isActive?: boolean }> }>(
        "/admin/categories",
        "GET",
        undefined,
        "admin"
      );
    },
    createCategory(payload: { name: string; description?: string; sortOrder?: number; isActive?: boolean }) {
      return request<any>("/admin/categories", "POST", payload, "admin");
    },
    updateCategory(id: string, payload: { name?: string; description?: string | null; sortOrder?: number; isActive?: boolean }) {
      return request<any>(`/admin/categories/${id}`, "PATCH", payload, "admin");
    },
    deleteCategory(id: string) {
      return request<any>(`/admin/categories/${id}`, "DELETE", undefined, "admin");
    },
    products(params?: { q?: string; page?: number; limit?: number; status?: "ACTIVE" | "DRAFT" }) {
      const search = new URLSearchParams();
      if (params?.q) search.set("q", params.q);
      if (params?.page) search.set("page", String(params.page));
      if (params?.limit) search.set("limit", String(params.limit));
      if (params?.status) search.set("status", params.status);
      const query = search.toString();
      return request<any>(`/admin/products${query ? `?${query}` : ""}`, "GET", undefined, "admin");
    },
    createProduct(payload: {
      title: string;
      description?: string;
      videoUrl?: string;
      status: "ACTIVE" | "DRAFT";
      featured?: boolean;
      badges?: Array<"new" | "bestseller" | "featured">;
      tags?: string[];
      priceCents: number;
      costCents?: number;
      compareAtPriceCents?: number;
      categoryIds?: string[];
      images?: Array<{ url: string; alt?: string; sortOrder?: number }>;
    }) {
      return request<any>("/admin/products", "POST", payload, "admin");
    },
    updateProduct(
      id: string,
      payload: {
        title?: string;
        description?: string | null;
        videoUrl?: string | null;
        status?: "ACTIVE" | "DRAFT";
        featured?: boolean;
        badges?: Array<"new" | "bestseller" | "featured">;
        tags?: string[];
        categoryIds?: string[];
        images?: Array<{ url: string; alt?: string; sortOrder?: number }>;
      }
    ) {
      return request<any>(`/admin/products/${id}`, "PATCH", payload, "admin");
    },
    deleteProduct(id: string) {
      return request<{ ok: true; archived?: boolean }>(`/admin/products/${id}`, "DELETE", undefined, "admin");
    },
    setProductFeatured(id: string, featured: boolean) {
      return request<any>(`/admin/products/${id}/featured`, "PATCH", { featured }, "admin");
    },
    updateVariant(
      id: string,
      payload: {
        title?: string;
        priceCents?: number;
        costCents?: number | null;
        compareAtPriceCents?: number | null;
        isActive?: boolean;
      }
    ) {
      return request<any>(`/admin/variants/${id}`, "PATCH", payload, "admin");
    },
    customers(params?: { q?: string; page?: number; limit?: number }) {
      const search = new URLSearchParams();
      if (params?.q) search.set("q", params.q);
      if (params?.page) search.set("page", String(params.page));
      if (params?.limit) search.set("limit", String(params.limit));
      const query = search.toString();
      return request<{
        items: Array<{
          id: string;
          name: string;
          email: string;
          phone?: string | null;
          totalOrders: number;
          totalSpentCents: number;
          joinedAt: string;
          address?: {
            line1: string;
            line2?: string | null;
            city: string;
            province: string;
            country: string;
            postalCode: string;
          } | null;
        }>;
        pagination: {
          page: number;
          limit: number;
          total: number;
          totalPages: number;
        };
      }>(`/admin/customers${query ? `?${query}` : ""}`, "GET", undefined, "admin");
    },
    customer(id: string) {
      return request<any>(`/admin/customers/${id}`, "GET", undefined, "admin");
    },
    salesSnapshot(params?: { period?: "7d" | "30d" | "90d"; start?: string; end?: string }) {
      const search = new URLSearchParams();
      if (params?.period) search.set("period", params.period);
      if (params?.start) search.set("start", params.start);
      if (params?.end) search.set("end", params.end);
      const query = search.toString();
      return request<{
        range: { start: string; end: string };
        summary: {
          grossSalesCents: number;
          ordersCount: number;
          avgOrderValueCents: number;
          unitsSold: number;
        };
        daily: Array<{
          date: string;
          grossSalesCents: number;
          ordersCount: number;
          unitsSold: number;
        }>;
      }>(`/admin/reports/sales-snapshot${query ? `?${query}` : ""}`, "GET", undefined, "admin");
    },
    salesByProduct(params?: { period?: "7d" | "30d" | "90d"; start?: string; end?: string; limit?: number }) {
      const search = new URLSearchParams();
      if (params?.period) search.set("period", params.period);
      if (params?.start) search.set("start", params.start);
      if (params?.end) search.set("end", params.end);
      if (params?.limit) search.set("limit", String(params.limit));
      const query = search.toString();
      return request<{
        range: { start: string; end: string };
        items: Array<{
          productId: string;
          variantId: string;
          title: string;
          sku?: string | null;
          unitsSold: number;
          revenueCents: number;
          avgUnitPriceCents: number;
        }>;
      }>(`/admin/reports/sales-by-product${query ? `?${query}` : ""}`, "GET", undefined, "admin");
    },
    inventoryOnHandCost(params?: { limit?: number }) {
      const search = new URLSearchParams();
      if (params?.limit) search.set("limit", String(params.limit));
      const query = search.toString();
      return request<{
        asOf: string;
        summary: {
          totalOnHandUnits: number;
          totalInventoryCostCents: number;
        };
        items: Array<{
          productId: string;
          variantId: string;
          productTitle: string;
          variantTitle: string;
          sku?: string | null;
          onHandUnits: number;
          unitCostCents: number;
          extendedCostCents: number;
        }>;
      }>(`/admin/reports/inventory-on-hand-cost${query ? `?${query}` : ""}`, "GET", undefined, "admin");
    },
    faqs() {
      return request<{
        items: Array<{
          id: string;
          question: string;
          answer: string;
          sortOrder: number;
          createdAt: string;
          updatedAt: string;
        }>;
      }>("/admin/faqs", "GET", undefined, "admin");
    },
    createFaq(payload: { question: string; answer: string; sortOrder?: number }) {
      return request<any>("/admin/faqs", "POST", payload, "admin");
    },
    updateFaq(id: string, payload: { question?: string; answer?: string; sortOrder?: number }) {
      return request<any>(`/admin/faqs/${id}`, "PATCH", payload, "admin");
    },
    deleteFaq(id: string) {
      return request<{ ok: true }>(`/admin/faqs/${id}`, "DELETE", undefined, "admin");
    },
    theme() {
      return request<{
        primaryColor: string;
        secondaryColor: string;
        buttonColor: string;
        headerBgColor: string;
        font: string;
        tagline: string;
        showFeaturedSection: boolean;
        showCategorySection: boolean;
        showNewsletterSection: boolean;
        sectionOrder: string[];
      }>("/admin/theme", "GET", undefined, "admin");
    },
    updateTheme(
      payload: Partial<{
        primaryColor: string;
        secondaryColor: string;
        buttonColor: string;
        headerBgColor: string;
        font: string;
        tagline: string;
        showFeaturedSection: boolean;
        showCategorySection: boolean;
        showNewsletterSection: boolean;
        sectionOrder: string[];
      }>
    ) {
      return request<any>("/admin/theme", "PATCH", payload, "admin");
    },
    paymentSettings() {
      return request<{
        items: Array<{
          id: "stripe" | "other";
          name: string;
          enabled: boolean;
          active: boolean;
          publicKey?: string;
          manualPaymentEmail?: string;
          secretKey?: string;
          testMode: boolean;
        }>;
      }>("/admin/settings/payments", "GET", undefined, "admin");
    },
    updatePaymentSetting(
      provider: "stripe" | "other",
      payload: {
        enabled?: boolean;
        publicKey?: string;
        secretKey?: string;
        testMode?: boolean;
        manualPaymentEmail?: string;
      }
    ) {
      return request<any>(`/admin/settings/payments/${provider}`, "PATCH", payload, "admin");
    },
    activatePaymentProvider(provider: "stripe" | "other") {
      return request<any>(`/admin/settings/payments/${provider}/activate`, "POST", {}, "admin");
    },
    locations() {
      return request<{
        items: Array<{
          id: string;
          name: string;
          code: string;
          address?: string | null;
          isActive: boolean;
          createdAt: string;
        }>;
      }>("/admin/locations", "GET", undefined, "admin");
    },
    createLocation(payload: { name: string; code?: string; address?: string; isActive?: boolean }) {
      return request<any>("/admin/locations", "POST", payload, "admin");
    },
    updateLocation(id: string, payload: { name?: string; address?: string | null; isActive?: boolean }) {
      return request<any>(`/admin/locations/${id}`, "PATCH", payload, "admin");
    },
    deleteLocation(id: string) {
      return request<{ ok: true; deactivated?: boolean }>(`/admin/locations/${id}`, "DELETE", undefined, "admin");
    },
    inventory(params?: { variantId?: string; locationId?: string }) {
      const search = new URLSearchParams();
      if (params?.variantId) search.set("variantId", params.variantId);
      if (params?.locationId) search.set("locationId", params.locationId);
      const query = search.toString();
      return request<{
        items: Array<{
          id: string | null;
          variantId: string;
          locationId: string;
          onHand: number;
          reserved: number;
          updatedAt?: string | null;
          threshold?: number | null;
        }>;
      }>(`/admin/inventory${query ? `?${query}` : ""}`, "GET", undefined, "admin");
    },
    adjustInventory(payload: { variantId: string; locationId: string; delta: number; note?: string }) {
      return request<any>("/admin/inventory/adjust", "POST", payload, "admin");
    },
    setInventoryThreshold(payload: { variantId: string; locationId: string; threshold: number }) {
      return request<any>("/admin/inventory/threshold", "PUT", payload, "admin");
    },
    inventoryMovements(params?: { variantId?: string; locationId?: string; page?: number; limit?: number }) {
      const search = new URLSearchParams();
      if (params?.variantId) search.set("variantId", params.variantId);
      if (params?.locationId) search.set("locationId", params.locationId);
      if (params?.page) search.set("page", String(params.page));
      if (params?.limit) search.set("limit", String(params.limit));
      const query = search.toString();
      return request<{
        items: Array<{
          id: string;
          variantId: string;
          productId: string;
          locationId: string;
          locationName: string;
          delta: number;
          reason: string;
          note?: string | null;
          createdAt: string;
        }>;
      }>(`/admin/inventory/movements${query ? `?${query}` : ""}`, "GET", undefined, "admin");
    },
    orders(params?: {
      q?: string;
      paymentStatus?: "UNPAID" | "AUTHORIZED" | "PAID" | "PARTIALLY_REFUNDED" | "REFUNDED" | "FAILED" | "CANCELED";
      fulfillmentStatus?: "UNFULFILLED" | "PICKING" | "PACKED" | "SHIPPED" | "DELIVERED" | "CANCELED";
      page?: number;
      limit?: number;
    }) {
      const search = new URLSearchParams();
      if (params?.q) search.set("q", params.q);
      if (params?.paymentStatus) search.set("paymentStatus", params.paymentStatus);
      if (params?.fulfillmentStatus) search.set("fulfillmentStatus", params.fulfillmentStatus);
      if (params?.page) search.set("page", String(params.page));
      if (params?.limit) search.set("limit", String(params.limit));
      const query = search.toString();
      return request<any>(`/admin/orders${query ? `?${query}` : ""}`, "GET", undefined, "admin");
    },
    order(id: string) {
      return request<any>(`/admin/orders/${id}`, "GET", undefined, "admin");
    },
    updateOrderFulfillment(
      id: string,
      fulfillmentStatus: "UNFULFILLED" | "PICKING" | "PACKED" | "SHIPPED" | "DELIVERED" | "CANCELED",
      trackingNumber?: string
    ) {
      return request<any>(
        `/admin/orders/${id}/fulfillment`,
        "PATCH",
        {
          fulfillmentStatus,
          ...(trackingNumber !== undefined ? { trackingNumber } : {})
        },
        "admin"
      );
    },
    shippingMethods() {
      return request<{
        items: Array<{
          id: string;
          type: "FLAT_RATE" | "LOCAL_DELIVERY" | "PICKUP";
          name: string;
          enabled: boolean;
          configJson: Record<string, unknown>;
        }>;
      }>("/admin/settings/shipping-methods", "GET", undefined, "admin");
    },
    updateShippingMethod(
      type: "FLAT_RATE" | "LOCAL_DELIVERY" | "PICKUP",
      payload: { enabled?: boolean; name?: string; configJson?: Record<string, unknown> }
    ) {
      return request<any>(`/admin/settings/shipping-methods/${type}`, "PATCH", payload, "admin");
    },
    taxRates() {
      return request<{
        items: Array<{
          id: string;
          name: string;
          enabled: boolean;
          country?: string | null;
          province?: string | null;
          postalPrefix?: string | null;
          rateBps: number;
          priority: number;
        }>;
      }>("/admin/tax-rates", "GET", undefined, "admin");
    },
    createTaxRate(payload: {
      name: string;
      enabled?: boolean;
      country?: string | null;
      province?: string | null;
      postalPrefix?: string | null;
      rateBps: number;
      priority?: number;
    }) {
      return request<any>("/admin/tax-rates", "POST", payload, "admin");
    },
    updateTaxRate(
      id: string,
      payload: {
        name?: string;
        enabled?: boolean;
        country?: string | null;
        province?: string | null;
        postalPrefix?: string | null;
        rateBps?: number;
        priority?: number;
      }
    ) {
      return request<any>(`/admin/tax-rates/${id}`, "PATCH", payload, "admin");
    },
    deleteTaxRate(id: string) {
      return request<{ ok: true }>(`/admin/tax-rates/${id}`, "DELETE", undefined, "admin");
    },
    couponDiscounts() {
      return request<{ items: any[] }>("/admin/discounts/coupons", "GET", undefined, "admin");
    },
    createCouponDiscount(payload: {
      code: string;
      enabled?: boolean;
      type: "PERCENT" | "FIXED";
      percentBps?: number | null;
      amountCents?: number | null;
      minSubtotalCents?: number;
      maxRedemptions?: number | null;
      maxRedemptionsPerCustomer?: number | null;
      expiresAt?: string | null;
    }) {
      return request<any>("/admin/discounts/coupons", "POST", payload, "admin");
    },
    updateCouponDiscount(
      id: string,
      payload: {
        code?: string;
        enabled?: boolean;
        type?: "PERCENT" | "FIXED";
        percentBps?: number | null;
        amountCents?: number | null;
        minSubtotalCents?: number;
        maxRedemptions?: number | null;
        maxRedemptionsPerCustomer?: number | null;
        expiresAt?: string | null;
      }
    ) {
      return request<any>(`/admin/discounts/coupons/${id}`, "PATCH", payload, "admin");
    },
    deleteCouponDiscount(id: string) {
      return request<{ ok: true }>(`/admin/discounts/coupons/${id}`, "DELETE", undefined, "admin");
    },
    categoryDiscounts() {
      return request<{ items: any[] }>("/admin/discounts/category", "GET", undefined, "admin");
    },
    createCategoryDiscount(payload: {
      categoryId: string;
      enabled?: boolean;
      type: "PERCENT" | "FIXED";
      percentBps?: number | null;
      amountCents?: number | null;
      startsAt?: string | null;
      endsAt?: string | null;
    }) {
      return request<any>("/admin/discounts/category", "POST", payload, "admin");
    },
    updateCategoryDiscount(
      id: string,
      payload: {
        categoryId?: string;
        enabled?: boolean;
        type?: "PERCENT" | "FIXED";
        percentBps?: number | null;
        amountCents?: number | null;
        startsAt?: string | null;
        endsAt?: string | null;
      }
    ) {
      return request<any>(`/admin/discounts/category/${id}`, "PATCH", payload, "admin");
    },
    deleteCategoryDiscount(id: string) {
      return request<{ ok: true }>(`/admin/discounts/category/${id}`, "DELETE", undefined, "admin");
    },
    emailRoutes() {
      return request<{
        items: Array<{
          id: string;
          type:
            | "CUSTOMER_CONFIRMATION"
            | "PACKING"
            | "WAREHOUSE"
            | "SHIPPED_CONFIRMATION"
            | "DELIVERED_CONFIRMATION";
          enabled: boolean;
        }>;
      }>(
        "/admin/settings/emails/routes",
        "GET",
        undefined,
        "admin"
      );
    },
    updateEmailRoute(
      type:
        | "CUSTOMER_CONFIRMATION"
        | "PACKING"
        | "WAREHOUSE"
        | "SHIPPED_CONFIRMATION"
        | "DELIVERED_CONFIRMATION",
      enabled: boolean
    ) {
      return request<any>(`/admin/settings/emails/routes/${type}`, "PATCH", { enabled }, "admin");
    },
    emailRecipients(
      type:
        | "CUSTOMER_CONFIRMATION"
        | "PACKING"
        | "WAREHOUSE"
        | "SHIPPED_CONFIRMATION"
        | "DELIVERED_CONFIRMATION"
    ) {
      return request<{ to: string[]; cc: string[]; bcc: string[] }>(
        `/admin/settings/emails/recipients/${type}`,
        "GET",
        undefined,
        "admin"
      );
    },
    updateEmailRecipients(
      type:
        | "CUSTOMER_CONFIRMATION"
        | "PACKING"
        | "WAREHOUSE"
        | "SHIPPED_CONFIRMATION"
        | "DELIVERED_CONFIRMATION",
      payload: { to: string[]; cc: string[]; bcc: string[] }
    ) {
      return request<any>(`/admin/settings/emails/recipients/${type}`, "PUT", payload, "admin");
    },
    emailTemplate(
      type:
        | "CUSTOMER_CONFIRMATION"
        | "PACKING"
        | "WAREHOUSE"
        | "SHIPPED_CONFIRMATION"
        | "DELIVERED_CONFIRMATION"
    ) {
      return request<{ subject: string; html: string; text?: string }>(
        `/admin/settings/emails/templates/${type}`,
        "GET",
        undefined,
        "admin"
      );
    },
    updateEmailTemplate(
      type:
        | "CUSTOMER_CONFIRMATION"
        | "PACKING"
        | "WAREHOUSE"
        | "SHIPPED_CONFIRMATION"
        | "DELIVERED_CONFIRMATION",
      payload: { subject: string; html: string; text?: string }
    ) {
      return request<any>(`/admin/settings/emails/templates/${type}`, "PUT", payload, "admin");
    },
    storeSettings() {
      return request<{
        name: string;
        email: string;
        websiteUrl: string;
        businessType: string;
        phone: string;
        addressLine1: string;
        addressLine2: string;
        city: string;
        stateOrProvince: string;
        postalCode: string;
        countryCode: string;
        logoUrl: string;
        sameAs: string[];
        openingHours: Array<{
          dayOfWeek: "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday" | "Sunday";
          opens?: string | null;
          closes?: string | null;
          closed?: boolean;
        }>;
        priceRange: string;
        geoLat: number | null;
        geoLng: number | null;
        googleMapsUrl: string;
        hasPhysicalStorefront: boolean;
        currency: string;
        timezone: string;
      }>(
        "/admin/settings/store",
        "GET",
        undefined,
        "admin"
      );
    },
    updateStoreSettings(payload: {
      name?: string;
      email?: string | null;
      websiteUrl?: string | null;
      businessType?: string | null;
      phone?: string | null;
      addressLine1?: string | null;
      addressLine2?: string | null;
      city?: string | null;
      stateOrProvince?: string | null;
      postalCode?: string | null;
      countryCode?: string | null;
      logoUrl?: string | null;
      sameAs?: string[] | null;
      openingHours?: Array<{
        dayOfWeek: "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday" | "Sunday";
        opens?: string | null;
        closes?: string | null;
        closed?: boolean;
      }> | null;
      priceRange?: string | null;
      geoLat?: number | null;
      geoLng?: number | null;
      googleMapsUrl?: string | null;
      hasPhysicalStorefront?: boolean;
      currency?: string;
      timezone?: string;
    }) {
      return request<any>("/admin/settings/store", "PATCH", payload, "admin");
    }
  },
  store: {
    addresses() {
      return request<{
        items: Array<{
          id: string;
          name: string;
          line1: string;
          line2?: string | null;
          city: string;
          province: string;
          country: string;
          postalCode: string;
          phone?: string | null;
          isDefault: boolean;
        }>;
      }>("/store/addresses", "GET", undefined, "customer");
    },
    createAddress(payload: {
      name: string;
      line1: string;
      line2?: string;
      city: string;
      province: string;
      country: string;
      postalCode: string;
      phone?: string;
      isDefault?: boolean;
    }) {
      return request<any>("/store/addresses", "POST", payload, "customer");
    },
    updateAddress(
      id: string,
      payload: {
        name?: string;
        line1?: string;
        line2?: string | null;
        city?: string;
        province?: string;
        country?: string;
        postalCode?: string;
        phone?: string | null;
        isDefault?: boolean;
      }
    ) {
      return request<any>(`/store/addresses/${id}`, "PATCH", payload, "customer");
    },
    deleteAddress(id: string) {
      return request<{ ok: true }>(`/store/addresses/${id}`, "DELETE", undefined, "customer");
    },
    categories() {
      return request<{ items: Array<{ id: string; name: string; slug: string; description?: string; sortOrder: number }> }>(
        "/store/categories",
        "GET"
      );
    },
    products(params?: { categorySlug?: string; q?: string; page?: number; limit?: number }) {
      const search = new URLSearchParams();
      if (params?.categorySlug) search.set("categorySlug", params.categorySlug);
      if (params?.q) search.set("q", params.q);
      if (params?.page) search.set("page", String(params.page));
      if (params?.limit) search.set("limit", String(params.limit));
      const query = search.toString();
      return request<{
        items: Array<{
          id: string;
          title: string;
          slug: string;
          description?: string | null;
          videoUrl?: string | null;
          featured?: boolean;
          badges?: Array<"new" | "bestseller" | "featured">;
          tags?: string[];
          images: Array<{ url: string; alt?: string | null }>;
          categories: Array<{ id: string; name: string; slug: string }>;
          variants: Array<{
            id: string;
            title?: string | null;
            sku?: string | null;
            priceCents: number;
            compareAtPriceCents?: number | null;
            onHand?: number;
            reserved?: number;
            available?: number;
          }>;
        }>;
      }>(`/store/products${query ? `?${query}` : ""}`, "GET");
    },
    faqs() {
      return request<{
        items: Array<{
          id: string;
          question: string;
          answer: string;
          sortOrder: number;
        }>;
      }>("/store/faqs", "GET");
    },
    theme() {
      return request<{
        primaryColor: string;
        secondaryColor: string;
        buttonColor: string;
        headerBgColor: string;
        font: string;
        tagline: string;
        showFeaturedSection: boolean;
        showCategorySection: boolean;
        showNewsletterSection: boolean;
        sectionOrder: string[];
      }>("/store/theme", "GET");
    },
    settings() {
      return request<{
        name: string;
        email: string;
        websiteUrl: string;
        businessType: string;
        phone: string;
        addressLine1: string;
        addressLine2: string;
        city: string;
        stateOrProvince: string;
        postalCode: string;
        countryCode: string;
        logoUrl: string;
        sameAs: string[];
        openingHours: Array<{
          dayOfWeek: "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday" | "Sunday";
          opens?: string | null;
          closes?: string | null;
          closed?: boolean;
        }>;
        priceRange: string;
        geoLat: number | null;
        geoLng: number | null;
        googleMapsUrl: string;
        hasPhysicalStorefront: boolean;
        currency: string;
        timezone: string;
      }>("/store/settings", "GET");
    },
    page(slug: string) {
      return request<{
        id: string;
        slug: string;
        title: string;
        body: Record<string, unknown>;
        updatedAt: string;
      }>(`/store/pages/${encodeURIComponent(slug)}`, "GET");
    },
    paymentSettings() {
      return request<{
        items: Array<{
          id: "stripe" | "other";
          name: string;
          enabled: boolean;
          active: boolean;
          testMode: boolean;
        }>;
      }>("/store/payments", "GET");
    },
    cart() {
      return request<{
        id: string;
        items: Array<{
          id: string;
          variantId: string;
          quantity: number;
          variant: { id: string; title?: string | null; sku?: string | null; priceCents: number };
        }>;
      }>("/store/cart", "GET", undefined, "customer");
    },
    addCartItem(payload: { variantId: string; quantity: number }) {
      return request("/store/cart/items", "POST", payload, "customer");
    },
    updateCartItem(id: string, payload: { quantity: number }) {
      return request(`/store/cart/items/${id}`, "PATCH", payload, "customer");
    },
    deleteCartItem(id: string) {
      return request(`/store/cart/items/${id}`, "DELETE", undefined, "customer");
    },
    shippingMethods(params: { country?: string; province?: string; postalCode?: string }) {
      const search = new URLSearchParams();
      if (params.country) search.set("country", params.country);
      if (params.province) search.set("province", params.province);
      if (params.postalCode) search.set("postalCode", params.postalCode);
      const query = search.toString();
      return request<Array<{ type: "FLAT_RATE" | "LOCAL_DELIVERY" | "PICKUP"; enabled: boolean; name: string; configJson?: Record<string, unknown> }>>(
        `/store/checkout/shipping-methods${query ? `?${query}` : ""}`,
        "GET",
        undefined,
        "customer"
      );
    },
    taxPreview(payload: {
      shippingAddress: { country?: string; province?: string; postalCode?: string };
      subtotalCents: number;
      shippingCents: number;
      discountCents: number;
    }) {
      return request<{ taxCents: number; rateBps: number }>("/store/checkout/tax-preview", "POST", payload, "customer");
    },
    createPaymentIntent(payload: { shippingMethodType: "FLAT_RATE" | "LOCAL_DELIVERY" | "PICKUP"; shippingAddressId?: string; couponCode?: string }) {
      return request<{ clientSecret: string; paymentIntentId: string; amountCents: number }>(
        "/store/checkout/create-payment-intent",
        "POST",
        payload,
        "customer"
      );
    },
    confirmCheckout(payload: {
      shippingMethodType: "FLAT_RATE" | "LOCAL_DELIVERY" | "PICKUP";
      shippingAddressId?: string;
      couponCode?: string;
      paymentIntentId: string;
    }) {
      return request<any>("/store/checkout/confirm", "POST", payload, "customer");
    },
    orders() {
      return request<{ items: any[] }>("/store/orders", "GET", undefined, "customer");
    }
  }
};

export type { ApiError };
