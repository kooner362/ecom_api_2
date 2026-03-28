import { prisma } from "@ecom/db";

const db = prisma as any;

export interface OpeningHourInput {
  dayOfWeek: "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday" | "Sunday";
  opens?: string | null;
  closes?: string | null;
  closed?: boolean;
}

export interface StoreSettingsInput {
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
  openingHours?: OpeningHourInput[] | null;
  priceRange?: string | null;
  geoLat?: number | null;
  geoLng?: number | null;
  googleMapsUrl?: string | null;
  hasPhysicalStorefront?: boolean;
  currency?: string;
  timezone?: string;
}

function mapSettings(storeName: string, settings: any) {
  return {
    name: storeName,
    email: settings?.email || "",
    websiteUrl: settings?.websiteUrl || "",
    businessType: settings?.businessType || "Store",
    phone: settings?.phone || "",
    addressLine1: settings?.addressLine1 || "",
    addressLine2: settings?.addressLine2 || "",
    city: settings?.city || "",
    stateOrProvince: settings?.stateOrProvince || "",
    postalCode: settings?.postalCode || "",
    countryCode: settings?.countryCode || "",
    logoUrl: settings?.logoUrl || "",
    sameAs: Array.isArray(settings?.sameAs) ? settings.sameAs : [],
    openingHours: Array.isArray(settings?.openingHours) ? settings.openingHours : [],
    priceRange: settings?.priceRange || "",
    geoLat: typeof settings?.geoLat === "number" ? settings.geoLat : null,
    geoLng: typeof settings?.geoLng === "number" ? settings.geoLng : null,
    googleMapsUrl: settings?.googleMapsUrl || "",
    hasPhysicalStorefront: settings?.hasPhysicalStorefront ?? true,
    currency: settings?.currency || "CAD",
    timezone: settings?.timezone || "America/Toronto"
  };
}

export const storeSettingsService = {
  async ensureDefaults(storeId: string) {
    await db.storeSetting.upsert({
      where: { storeId },
      create: {
        storeId,
        currency: "CAD",
        timezone: "America/Toronto"
      },
      update: {}
    });
  },

  async get(storeId: string) {
    await this.ensureDefaults(storeId);

    const [store, settings] = await Promise.all([
      db.store.findUnique({ where: { id: storeId }, select: { name: true } }),
      db.storeSetting.findUnique({ where: { storeId } })
    ]);

    return mapSettings(store?.name || "Store", settings);
  },

  async update(storeId: string, input: StoreSettingsInput) {
    await this.ensureDefaults(storeId);

    if (input.name !== undefined) {
      await db.store.update({
        where: { id: storeId },
        data: {
          name: input.name
        }
      });
    }

    await db.storeSetting.update({
      where: { storeId },
      data: {
        ...(input.email !== undefined ? { email: input.email } : {}),
        ...(input.websiteUrl !== undefined ? { websiteUrl: input.websiteUrl } : {}),
        ...(input.businessType !== undefined ? { businessType: input.businessType } : {}),
        ...(input.phone !== undefined ? { phone: input.phone } : {}),
        ...(input.addressLine1 !== undefined ? { addressLine1: input.addressLine1 } : {}),
        ...(input.addressLine2 !== undefined ? { addressLine2: input.addressLine2 } : {}),
        ...(input.city !== undefined ? { city: input.city } : {}),
        ...(input.stateOrProvince !== undefined ? { stateOrProvince: input.stateOrProvince } : {}),
        ...(input.postalCode !== undefined ? { postalCode: input.postalCode } : {}),
        ...(input.countryCode !== undefined ? { countryCode: input.countryCode } : {}),
        ...(input.logoUrl !== undefined ? { logoUrl: input.logoUrl } : {}),
        ...(input.sameAs !== undefined ? { sameAs: (input.sameAs ?? []) as any } : {}),
        ...(input.openingHours !== undefined ? { openingHours: (input.openingHours ?? []) as any } : {}),
        ...(input.priceRange !== undefined ? { priceRange: input.priceRange } : {}),
        ...(input.geoLat !== undefined ? { geoLat: input.geoLat } : {}),
        ...(input.geoLng !== undefined ? { geoLng: input.geoLng } : {}),
        ...(input.googleMapsUrl !== undefined ? { googleMapsUrl: input.googleMapsUrl } : {}),
        ...(input.hasPhysicalStorefront !== undefined ? { hasPhysicalStorefront: input.hasPhysicalStorefront } : {}),
        ...(input.currency !== undefined ? { currency: input.currency } : {}),
        ...(input.timezone !== undefined ? { timezone: input.timezone } : {})
      }
    });

    return this.get(storeId);
  },

  async getPublic(storeId: string) {
    const settings = await this.get(storeId);
    return settings;
  }
};
