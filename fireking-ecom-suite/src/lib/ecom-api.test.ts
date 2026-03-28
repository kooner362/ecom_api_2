import { beforeEach, describe, expect, it, vi } from "vitest";
import { ADMIN_TOKEN_KEY, CUSTOMER_TOKEN_KEY, ecomApi } from "./ecom-api";

function mockJsonResponse(payload: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(payload)
  } as unknown as Response;
}

describe("ecomApi request wiring", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("calls GET /store/addresses with customer auth header", async () => {
    localStorage.setItem(CUSTOMER_TOKEN_KEY, "customer-token");
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(mockJsonResponse({ items: [] }));

    await ecomApi.store.addresses();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith(
      "http://localhost:3000/store/addresses",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          authorization: "Bearer customer-token"
        })
      })
    );
  });

  it("calls POST /store/addresses with payload", async () => {
    localStorage.setItem(CUSTOMER_TOKEN_KEY, "customer-token");
    const payload = {
      name: "Jane Doe",
      line1: "123 Main St",
      city: "Toronto",
      province: "ON",
      country: "CA",
      postalCode: "M5V2T6"
    };
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(mockJsonResponse({ id: "addr_1", ...payload, isDefault: true }));

    await ecomApi.store.createAddress(payload);

    expect(fetchSpy).toHaveBeenCalledWith(
      "http://localhost:3000/store/addresses",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(payload),
        headers: expect.objectContaining({
          authorization: "Bearer customer-token"
        })
      })
    );
  });

  it("calls PATCH /store/addresses/:id with payload", async () => {
    localStorage.setItem(CUSTOMER_TOKEN_KEY, "customer-token");
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(mockJsonResponse({ id: "addr_1", city: "Vancouver" }));

    await ecomApi.store.updateAddress("addr_1", { city: "Vancouver" });

    expect(fetchSpy).toHaveBeenCalledWith(
      "http://localhost:3000/store/addresses/addr_1",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ city: "Vancouver" })
      })
    );
  });

  it("calls DELETE /store/addresses/:id", async () => {
    localStorage.setItem(CUSTOMER_TOKEN_KEY, "customer-token");
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(mockJsonResponse({ ok: true }));

    await ecomApi.store.deleteAddress("addr_1");

    expect(fetchSpy).toHaveBeenCalledWith(
      "http://localhost:3000/store/addresses/addr_1",
      expect.objectContaining({
        method: "DELETE"
      })
    );
  });

  it("calls GET /admin/products with query parameters and admin auth header", async () => {
    localStorage.setItem(ADMIN_TOKEN_KEY, "admin-token");
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(mockJsonResponse({ items: [] }));

    await ecomApi.admin.products({ page: 1, limit: 200 });

    expect(fetchSpy).toHaveBeenCalledWith(
      "http://localhost:3000/admin/products?page=1&limit=200",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          authorization: "Bearer admin-token"
        })
      })
    );
  });

  it("calls DELETE /admin/products/:id with admin auth header", async () => {
    localStorage.setItem(ADMIN_TOKEN_KEY, "admin-token");
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(mockJsonResponse({ ok: true, archived: true }));

    await ecomApi.admin.deleteProduct("prod_1");

    expect(fetchSpy).toHaveBeenCalledWith(
      "http://localhost:3000/admin/products/prod_1",
      expect.objectContaining({
        method: "DELETE",
        headers: expect.objectContaining({
          authorization: "Bearer admin-token"
        })
      })
    );
  });

  it("calls PATCH /admin/products/:id/featured with admin auth header and payload", async () => {
    localStorage.setItem(ADMIN_TOKEN_KEY, "admin-token");
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(mockJsonResponse({ id: "prod_1", featured: true }));

    await ecomApi.admin.setProductFeatured("prod_1", true);

    expect(fetchSpy).toHaveBeenCalledWith(
      "http://localhost:3000/admin/products/prod_1/featured",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ featured: true }),
        headers: expect.objectContaining({
          authorization: "Bearer admin-token"
        })
      })
    );
  });

  it("calls GET /admin/locations with admin auth header", async () => {
    localStorage.setItem(ADMIN_TOKEN_KEY, "admin-token");
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(mockJsonResponse({ items: [] }));

    await ecomApi.admin.locations();

    expect(fetchSpy).toHaveBeenCalledWith(
      "http://localhost:3000/admin/locations",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          authorization: "Bearer admin-token"
        })
      })
    );
  });

  it("calls POST /admin/inventory/adjust with payload and admin auth header", async () => {
    localStorage.setItem(ADMIN_TOKEN_KEY, "admin-token");
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(mockJsonResponse({ ok: true }));

    await ecomApi.admin.adjustInventory({ variantId: "var_1", locationId: "loc_1", delta: 5, note: "restock" });

    expect(fetchSpy).toHaveBeenCalledWith(
      "http://localhost:3000/admin/inventory/adjust",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ variantId: "var_1", locationId: "loc_1", delta: 5, note: "restock" }),
        headers: expect.objectContaining({
          authorization: "Bearer admin-token"
        })
      })
    );
  });

  it("calls GET /admin/customers with query params and admin auth header", async () => {
    localStorage.setItem(ADMIN_TOKEN_KEY, "admin-token");
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(mockJsonResponse({ items: [] }));

    await ecomApi.admin.customers({ page: 1, limit: 200 });

    expect(fetchSpy).toHaveBeenCalledWith(
      "http://localhost:3000/admin/customers?page=1&limit=200",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          authorization: "Bearer admin-token"
        })
      })
    );
  });

  it("calls GET /admin/customers/:id with admin auth header", async () => {
    localStorage.setItem(ADMIN_TOKEN_KEY, "admin-token");
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(mockJsonResponse({ id: "cust_1" }));

    await ecomApi.admin.customer("cust_1");

    expect(fetchSpy).toHaveBeenCalledWith(
      "http://localhost:3000/admin/customers/cust_1",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          authorization: "Bearer admin-token"
        })
      })
    );
  });

  it("calls GET /admin/faqs with admin auth header", async () => {
    localStorage.setItem(ADMIN_TOKEN_KEY, "admin-token");
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(mockJsonResponse({ items: [] }));

    await ecomApi.admin.faqs();

    expect(fetchSpy).toHaveBeenCalledWith(
      "http://localhost:3000/admin/faqs",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          authorization: "Bearer admin-token"
        })
      })
    );
  });

  it("calls PATCH /admin/theme with payload and admin auth header", async () => {
    localStorage.setItem(ADMIN_TOKEN_KEY, "admin-token");
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(mockJsonResponse({ primaryColor: "#000000" }));

    await ecomApi.admin.updateTheme({ primaryColor: "#000000" });

    expect(fetchSpy).toHaveBeenCalledWith(
      "http://localhost:3000/admin/theme",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ primaryColor: "#000000" }),
        headers: expect.objectContaining({
          authorization: "Bearer admin-token"
        })
      })
    );
  });

  it("calls GET /admin/settings/payments with admin auth header", async () => {
    localStorage.setItem(ADMIN_TOKEN_KEY, "admin-token");
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(mockJsonResponse({ items: [] }));

    await ecomApi.admin.paymentSettings();

    expect(fetchSpy).toHaveBeenCalledWith(
      "http://localhost:3000/admin/settings/payments",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          authorization: "Bearer admin-token"
        })
      })
    );
  });

  it("calls POST /admin/settings/payments/:provider/activate with admin auth header", async () => {
    localStorage.setItem(ADMIN_TOKEN_KEY, "admin-token");
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(mockJsonResponse({ id: "stripe", active: true }));

    await ecomApi.admin.activatePaymentProvider("stripe");

    expect(fetchSpy).toHaveBeenCalledWith(
      "http://localhost:3000/admin/settings/payments/stripe/activate",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          authorization: "Bearer admin-token"
        })
      })
    );
  });

  it("calls GET /store/faqs without auth header", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(mockJsonResponse({ items: [] }));

    await ecomApi.store.faqs();

    expect(fetchSpy).toHaveBeenCalledWith(
      "http://localhost:3000/store/faqs",
      expect.objectContaining({
        method: "GET"
      })
    );
  });

  it("calls GET /store/pages/:slug", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(mockJsonResponse({ id: "page_1", slug: "about" }));

    await ecomApi.store.page("about");

    expect(fetchSpy).toHaveBeenCalledWith(
      "http://localhost:3000/store/pages/about",
      expect.objectContaining({
        method: "GET"
      })
    );
  });

  it("calls GET /admin/settings/shipping-methods with admin auth header", async () => {
    localStorage.setItem(ADMIN_TOKEN_KEY, "admin-token");
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(mockJsonResponse({ items: [] }));

    await ecomApi.admin.shippingMethods();

    expect(fetchSpy).toHaveBeenCalledWith(
      "http://localhost:3000/admin/settings/shipping-methods",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          authorization: "Bearer admin-token"
        })
      })
    );
  });

  it("calls GET /admin/tax-rates with admin auth header", async () => {
    localStorage.setItem(ADMIN_TOKEN_KEY, "admin-token");
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(mockJsonResponse({ items: [] }));

    await ecomApi.admin.taxRates();

    expect(fetchSpy).toHaveBeenCalledWith(
      "http://localhost:3000/admin/tax-rates",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          authorization: "Bearer admin-token"
        })
      })
    );
  });

  it("calls GET /admin/discounts/coupons with admin auth header", async () => {
    localStorage.setItem(ADMIN_TOKEN_KEY, "admin-token");
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(mockJsonResponse({ items: [] }));

    await ecomApi.admin.couponDiscounts();

    expect(fetchSpy).toHaveBeenCalledWith(
      "http://localhost:3000/admin/discounts/coupons",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          authorization: "Bearer admin-token"
        })
      })
    );
  });

  it("calls GET /admin/settings/emails/routes with admin auth header", async () => {
    localStorage.setItem(ADMIN_TOKEN_KEY, "admin-token");
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(mockJsonResponse({ items: [] }));

    await ecomApi.admin.emailRoutes();

    expect(fetchSpy).toHaveBeenCalledWith(
      "http://localhost:3000/admin/settings/emails/routes",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          authorization: "Bearer admin-token"
        })
      })
    );
  });
});
