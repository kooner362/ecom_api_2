import { prisma } from "@ecom/db";
import type { ApiEnv } from "@ecom/shared";
import { hashPassword } from "./password.js";
import { shippingService } from "../services/shippingService.js";
import { encryptJson } from "./crypto.js";
import { emailTemplateService } from "../services/emailTemplateService.js";
import { contentService } from "../services/contentService.js";
import { storeSettingsService } from "../services/storeSettingsService.js";

const CATALOG_SEED = {
  categories: [
    { name: "Aerial Shells", slug: "aerial-shells", description: "Soaring shells for high-impact displays.", sortOrder: 1 },
    { name: "Roman Candles", slug: "roman-candles", description: "Classic colorful star effects.", sortOrder: 2 },
    { name: "Sparklers", slug: "sparklers", description: "Celebration essentials for all ages.", sortOrder: 3 },
    { name: "Cakes", slug: "cakes", description: "Multi-shot barrages for full shows.", sortOrder: 4 },
    { name: "Smoke", slug: "smoke", description: "Vivid smoke effects for events and photos.", sortOrder: 5 },
    { name: "Fountains", slug: "fountains", description: "Ground effects with low-noise sparkle.", sortOrder: 6 }
  ],
  products: [
    {
      title: "Phoenix Rising Shell Kit",
      slug: "phoenix-rising-shell-kit",
      description: "A premium 12-shell kit with red, gold, and silver bursts.",
      categorySlug: "aerial-shells",
      featured: true,
      badges: ["bestseller", "featured"],
      tags: ["shells", "aerial", "kit"],
      priceCents: 8999,
      compareAtPriceCents: 11999,
      sku: "FK-AS-001",
      image: "https://images.unsplash.com/photo-1533230408708-8f9f91d1235a?w=1200&q=80",
      stock: 45
    },
    {
      title: "Inferno Aerial Barrage",
      slug: "inferno-aerial-barrage",
      description: "36-shot rapid-fire cake with glitter and crossettes.",
      categorySlug: "cakes",
      featured: true,
      badges: ["featured", "new"],
      tags: ["aerial", "barrage"],
      priceCents: 14999,
      sku: "FK-AS-002",
      image: "https://images.unsplash.com/photo-1467810563316-b5476525c0f9?w=1200&q=80",
      stock: 18
    },
    {
      title: "Dragon's Breath Roman Candles",
      slug: "dragons-breath-roman-candles",
      description: "Pack of 6 candles with colorful comet effects.",
      categorySlug: "roman-candles",
      featured: true,
      badges: ["bestseller"],
      tags: ["roman", "classic"],
      priceCents: 3499,
      compareAtPriceCents: 4499,
      sku: "FK-RC-001",
      image: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=1200&q=80",
      stock: 120
    },
    {
      title: "Golden Rain Sparklers (20-pack)",
      slug: "golden-rain-sparklers-20-pack",
      description: "Premium 18-inch gold sparklers with a long burn.",
      categorySlug: "sparklers",
      featured: true,
      badges: ["bestseller"],
      tags: ["sparklers", "wedding"],
      priceCents: 1899,
      sku: "FK-SP-001",
      image: "https://images.unsplash.com/photo-1576485375217-d6a95e34d043?w=1200&q=80",
      stock: 300
    },
    {
      title: "Supernova 500-Shot Cake",
      slug: "supernova-500-shot-cake",
      description: "A high-volume finale cake with multicolor effects.",
      categorySlug: "cakes",
      featured: true,
      badges: ["new", "featured"],
      tags: ["cake", "professional"],
      priceCents: 29999,
      compareAtPriceCents: 34999,
      sku: "FK-CK-001",
      image: "https://images.unsplash.com/photo-1562322140-8baeececf3df?w=1200&q=80",
      stock: 8
    },
    {
      title: "Chromatic Smoke Grenade Set",
      slug: "chromatic-smoke-grenade-set",
      description: "Set of 8 smoke grenades in bright event colors.",
      categorySlug: "smoke",
      featured: false,
      badges: ["new"],
      tags: ["smoke", "photo"],
      priceCents: 4299,
      sku: "FK-SM-001",
      image: "https://images.unsplash.com/photo-1519750783826-e2420f4d687f?w=1200&q=80",
      stock: 75
    }
  ]
} as const;

async function ensureCatalogSeed(storeId: string) {
  const productCount = await prisma.product.count({ where: { storeId } });
  if (productCount > 0) {
    return;
  }

  for (const category of CATALOG_SEED.categories) {
    await prisma.category.upsert({
      where: {
        storeId_slug: {
          storeId,
          slug: category.slug
        }
      },
      create: {
        storeId,
        name: category.name,
        slug: category.slug,
        description: category.description,
        sortOrder: category.sortOrder,
        isActive: true
      },
      update: {
        name: category.name,
        description: category.description,
        sortOrder: category.sortOrder,
        isActive: true
      }
    });
  }

  const categories = await prisma.category.findMany({
    where: { storeId },
    select: { id: true, slug: true }
  });
  const categoryBySlug = new Map(categories.map((category: { slug: string; id: string }) => [category.slug, category.id]));

  const location = await prisma.location.upsert({
    where: {
      storeId_code: {
        storeId,
        code: "MAIN"
      }
    },
    create: {
      storeId,
      name: "Main Warehouse",
      code: "MAIN",
      address: "100 Sparks Way, Toronto, ON",
      isActive: true
    },
    update: {
      isActive: true
    }
  });

  for (const product of CATALOG_SEED.products) {
    const categoryId = categoryBySlug.get(product.categorySlug);
    if (!categoryId) {
      continue;
    }

    const created = await prisma.product.create({
      data: {
        storeId,
        title: product.title,
        slug: product.slug,
        description: product.description,
        status: "ACTIVE",
        featured: product.featured,
        badges: product.badges as any,
        tags: product.tags as any,
        images: {
          create: [
            {
              storeId,
              url: product.image,
              sortOrder: 0
            }
          ]
        },
        categories: {
          create: [
            {
              storeId,
              categoryId
            }
          ]
        },
        variants: {
          create: [
            {
              storeId,
              title: product.title,
              sku: product.sku,
              priceCents: product.priceCents,
              compareAtPriceCents: "compareAtPriceCents" in product ? product.compareAtPriceCents : undefined,
              isActive: true
            }
          ]
        }
      },
      include: {
        variants: {
          select: { id: true }
        }
      }
    });

    const variantId = created.variants[0]?.id;
    if (!variantId) {
      continue;
    }

    await prisma.inventoryLevel.upsert({
      where: {
        storeId_variantId_locationId: {
          storeId,
          variantId,
          locationId: location.id
        }
      },
      create: {
        storeId,
        variantId,
        locationId: location.id,
        onHand: product.stock,
        reserved: 0
      },
      update: {
        onHand: product.stock
      }
    });
  }
}

async function ensureTaxAndDiscountSeed(storeId: string) {
  const taxRateCount = await prisma.taxRate.count({ where: { storeId } });
  if (taxRateCount === 0) {
    await prisma.taxRate.createMany({
      data: [
        {
          storeId,
          name: "Ontario HST",
          enabled: true,
          country: "CA",
          province: "ON",
          postalPrefix: null,
          rateBps: 1300,
          priority: 10
        },
        {
          storeId,
          name: "British Columbia GST+PST",
          enabled: true,
          country: "CA",
          province: "BC",
          postalPrefix: null,
          rateBps: 1200,
          priority: 10
        },
        {
          storeId,
          name: "Alberta GST",
          enabled: true,
          country: "CA",
          province: "AB",
          postalPrefix: null,
          rateBps: 500,
          priority: 10
        }
      ]
    });
  }

  const couponCount = await prisma.coupon.count({ where: { storeId } });
  if (couponCount === 0) {
    await prisma.coupon.create({
      data: {
        storeId,
        code: "WELCOME10",
        enabled: true,
        type: "PERCENT",
        percentBps: 1000,
        amountCents: null,
        minSubtotalCents: 5000,
        maxRedemptions: null,
        maxRedemptionsPerCustomer: 1,
        expiresAt: null
      }
    });
  }

  const categoryDiscountCount = await prisma.categoryDiscount.count({ where: { storeId } });
  if (categoryDiscountCount === 0) {
    const sparklersCategory = await prisma.category.findFirst({
      where: { storeId, slug: "sparklers" },
      select: { id: true }
    });

    if (sparklersCategory) {
      await prisma.categoryDiscount.create({
        data: {
          storeId,
          categoryId: sparklersCategory.id,
          enabled: true,
          type: "PERCENT",
          percentBps: 1500,
          amountCents: null,
          startsAt: null,
          endsAt: null
        }
      });
    }
  }
}

async function ensureShippingSeed(storeId: string) {
  const enabledCount = await prisma.shippingMethod.count({
    where: { storeId, enabled: true }
  });

  if (enabledCount > 0) {
    return;
  }

  await prisma.shippingMethod.updateMany({
    where: { storeId, type: "FLAT_RATE" },
    data: {
      enabled: true,
      name: "Standard Shipping",
      configJson: { amountCents: 1500 }
    }
  });

  await prisma.shippingMethod.updateMany({
    where: { storeId, type: "LOCAL_DELIVERY" },
    data: {
      enabled: true,
      name: "Local Delivery",
      configJson: { amountCents: 1000, postalPrefixes: ["M5V", "M5A", "M4B"] }
    }
  });

  await prisma.shippingMethod.updateMany({
    where: { storeId, type: "PICKUP" },
    data: {
      enabled: true,
      name: "In-Store Pickup",
      configJson: { instructions: "Pick up at 100 Sparks Way, Toronto." }
    }
  });
}

export async function ensureSingleStore(env: ApiEnv): Promise<string> {
  const stores = await prisma.store.findMany({
    orderBy: { createdAt: "asc" },
    take: 2
  });

  if (stores.length > 1) {
    throw new Error("Expected exactly one Store row but found more than one");
  }

  const store =
    stores[0] ??
    (await prisma.store.create({
      data: {
        name: env.DEFAULT_STORE_NAME
      }
    }));

  if (env.ADMIN_BOOTSTRAP_EMAIL && env.ADMIN_BOOTSTRAP_PASSWORD) {
    const passwordHash = await hashPassword(env.ADMIN_BOOTSTRAP_PASSWORD);
    await prisma.adminUser.upsert({
      where: {
        storeId_email: {
          storeId: store.id,
          email: env.ADMIN_BOOTSTRAP_EMAIL.toLowerCase()
        }
      },
      create: {
        storeId: store.id,
        email: env.ADMIN_BOOTSTRAP_EMAIL.toLowerCase(),
        passwordHash
      },
      update: {
        passwordHash
      }
    });
  }

  await shippingService.ensureDefaultShippingMethods(store.id);
  await ensureShippingSeed(store.id);
  await emailTemplateService.ensureDefaults(store.id);
  await contentService.ensureDefaults(store.id);
  await storeSettingsService.ensureDefaults(store.id);
  // await ensureCatalogSeed(store.id);
  await ensureTaxAndDiscountSeed(store.id);

  await prisma.paymentProviderSetting.upsert({
    where: {
      storeId_provider: {
        storeId: store.id,
        provider: "STRIPE"
      }
    },
    create: {
      storeId: store.id,
      provider: "STRIPE",
      enabled: Boolean(env.STRIPE_SECRET_KEY),
      configEncrypted: env.STRIPE_SECRET_KEY
        ? (encryptJson({ secretKey: env.STRIPE_SECRET_KEY }, env.APP_ENCRYPTION_KEY) as any)
        : (encryptJson({}, env.APP_ENCRYPTION_KEY) as any)
    },
    update: {
      ...(env.STRIPE_SECRET_KEY
        ? {
            enabled: true,
            configEncrypted: encryptJson({ secretKey: env.STRIPE_SECRET_KEY }, env.APP_ENCRYPTION_KEY) as any
          }
        : {})
    }
  });

  return store.id;
}
