import { prisma } from "@ecom/db";
import { badRequest } from "../lib/errors.js";

const db = prisma as any;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

type ProductStatus = "DRAFT" | "ACTIVE";

type Tx = any;

export interface PaginationInput {
  page?: number;
  limit?: number;
}

export interface PaginationResult {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface CategoryInput {
  name: string;
  description?: string | null;
  isActive?: boolean;
  sortOrder?: number;
}

export interface ProductImageInput {
  url: string;
  alt?: string;
  sortOrder?: number;
}

export interface ProductOptionInput {
  name: string;
  position?: number;
  values: Array<{
    value: string;
    position?: number;
  }>;
}

export interface ProductVariantInput {
  sku?: string;
  title?: string;
  priceCents: number;
  costCents?: number;
  compareAtPriceCents?: number;
  isActive?: boolean;
  selections?: Array<{
    optionName: string;
    value: string;
  }>;
}

export interface CreateProductInput {
  title: string;
  description?: string;
  videoUrl?: string;
  status: ProductStatus;
  featured?: boolean;
  badges?: Array<"new" | "bestseller" | "featured">;
  tags?: string[];
  priceCents?: number;
  costCents?: number;
  compareAtPriceCents?: number;
  categoryIds?: string[];
  images?: ProductImageInput[];
  options?: ProductOptionInput[];
  variants?: ProductVariantInput[];
}

export interface UpdateProductInput {
  title?: string;
  description?: string | null;
  videoUrl?: string | null;
  status?: ProductStatus;
  featured?: boolean;
  badges?: Array<"new" | "bestseller" | "featured">;
  tags?: string[];
  categoryIds?: string[];
  images?: ProductImageInput[];
}

export interface ReplaceVariantsInput {
  options: ProductOptionInput[];
  variants: ProductVariantInput[];
}

export interface UpdateVariantInput {
  sku?: string | null;
  title?: string;
  priceCents?: number;
  costCents?: number | null;
  compareAtPriceCents?: number | null;
  isActive?: boolean;
}

function normalizePagination(input: PaginationInput): { skip: number; take: number; page: number; limit: number } {
  const page = Math.max(1, input.page ?? 1);
  const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, input.limit ?? DEFAULT_PAGE_SIZE));
  return {
    page,
    limit,
    skip: (page - 1) * limit,
    take: limit
  };
}

function buildPaginationMeta(page: number, limit: number, total: number): PaginationResult {
  return {
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit))
  };
}

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");

  return slug || "item";
}

async function generateUniqueSlug(tx: Tx, model: "product" | "category", storeId: string, source: string, excludeId?: string) {
  const baseSlug = slugify(source);
  let attempt = 0;

  while (attempt < 1000) {
    const slug = attempt === 0 ? baseSlug : `${baseSlug}-${attempt + 1}`;

    if (model === "category") {
      const existing = await tx.category.findFirst({
        where: {
          storeId,
          slug,
          ...(excludeId ? { id: { not: excludeId } } : {})
        },
        select: { id: true }
      });

      if (!existing) {
        return slug;
      }
    } else {
      const existing = await tx.product.findFirst({
        where: {
          storeId,
          slug,
          ...(excludeId ? { id: { not: excludeId } } : {})
        },
        select: { id: true }
      });

      if (!existing) {
        return slug;
      }
    }

    attempt += 1;
  }

  throw badRequest("Unable to generate unique slug", "SLUG_GENERATION_FAILED");
}

function validateVariantInput(options: ProductOptionInput[], variants: ProductVariantInput[]) {
  if (options.length === 0) {
    throw badRequest("Options are required when variants are provided", "INVALID_VARIANTS");
  }

  if (variants.length === 0) {
    throw badRequest("At least one variant is required", "INVALID_VARIANTS");
  }

  const optionNames = new Set<string>();
  for (const option of options) {
    const key = option.name.trim().toLowerCase();
    if (optionNames.has(key)) {
      throw badRequest(`Duplicate option name: ${option.name}`, "INVALID_OPTIONS");
    }
    optionNames.add(key);

    if (!option.values || option.values.length === 0) {
      throw badRequest(`Option ${option.name} must have values`, "INVALID_OPTIONS");
    }

    const seenValues = new Set<string>();
    for (const value of option.values) {
      const normalized = value.value.trim().toLowerCase();
      if (seenValues.has(normalized)) {
        throw badRequest(`Duplicate value ${value.value} for option ${option.name}`, "INVALID_OPTIONS");
      }
      seenValues.add(normalized);
    }
  }

  const seenCombinations = new Set<string>();

  for (const variant of variants) {
    if (!variant.selections || variant.selections.length !== options.length) {
      throw badRequest("Each variant must include exactly one selection per option", "INVALID_VARIANTS");
    }

    const keys = variant.selections.map((selection) => `${selection.optionName.toLowerCase()}=${selection.value.toLowerCase()}`);
    const deduped = new Set(keys);
    if (deduped.size !== options.length) {
      throw badRequest("Variant selections must not repeat options", "INVALID_VARIANTS");
    }

    const combo = keys.sort().join("|");
    if (seenCombinations.has(combo)) {
      throw badRequest("Duplicate variant option combination", "INVALID_VARIANTS");
    }
    seenCombinations.add(combo);
  }
}

const adminProductInclude = {
  images: {
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }]
  },
  categories: {
    include: {
      category: true
    }
  },
  options: {
    orderBy: [{ position: "asc" }, { id: "asc" }],
    include: {
      values: {
        orderBy: [{ position: "asc" }, { id: "asc" }]
      }
    }
  },
  variants: {
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    include: {
      optionValues: {
        include: {
          optionValue: {
            include: {
              option: true
            }
          }
        }
      }
    }
  }
};

function mapCategory(category: any) {
  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
    description: category.description,
    isActive: category.isActive,
    sortOrder: category.sortOrder,
    createdAt: category.createdAt
  };
}

function mapProduct(product: any) {
  return {
    id: product.id,
    title: product.title,
    slug: product.slug,
    description: product.description,
    videoUrl: product.videoUrl,
    status: product.status,
    featured: Boolean(product.featured),
    badges: Array.isArray(product.badges) ? product.badges : [],
    tags: Array.isArray(product.tags) ? product.tags : [],
    createdAt: product.createdAt,
    images: product.images.map((image: any) => ({
      id: image.id,
      url: image.url,
      alt: image.alt,
      sortOrder: image.sortOrder
    })),
    categories: product.categories.map((link: any) => mapCategory(link.category)),
    options: product.options.map((option: any) => ({
      id: option.id,
      name: option.name,
      position: option.position,
      values: option.values.map((value: any) => ({
        id: value.id,
        value: value.value,
        position: value.position
      }))
    })),
    variants: product.variants.map((variant: any) => ({
      id: variant.id,
      sku: variant.sku,
      title: variant.title,
      priceCents: variant.priceCents,
      costCents: variant.costCents,
      compareAtPriceCents: variant.compareAtPriceCents,
      isActive: variant.isActive,
      createdAt: variant.createdAt,
      selections: variant.optionValues.map((link: any) => ({
        optionName: link.optionValue.option.name,
        value: link.optionValue.value
      }))
    }))
  };
}

async function attachCategories(tx: Tx, storeId: string, productId: string, categoryIds: string[] | undefined) {
  if (!categoryIds) {
    return;
  }

  if (categoryIds.length === 0) {
    await tx.productCategory.deleteMany({ where: { productId, storeId } });
    return;
  }

  const categories = await tx.category.findMany({
    where: { storeId, id: { in: categoryIds } },
    select: { id: true }
  });

  if (categories.length !== new Set(categoryIds).size) {
    throw badRequest("One or more categories are invalid", "INVALID_CATEGORY_IDS");
  }

  await tx.productCategory.deleteMany({ where: { productId, storeId } });
  await tx.productCategory.createMany({
    data: categoryIds.map((categoryId) => ({
      storeId,
      productId,
      categoryId
    }))
  });
}

async function attachImages(tx: Tx, storeId: string, productId: string, images: ProductImageInput[] | undefined) {
  if (!images) {
    return;
  }

  await tx.productImage.deleteMany({ where: { productId, storeId } });

  if (images.length === 0) {
    return;
  }

  await tx.productImage.createMany({
    data: images.map((image, index) => ({
      storeId,
      productId,
      url: image.url,
      alt: image.alt,
      sortOrder: image.sortOrder ?? index
    }))
  });
}

async function createOptionsAndVariants(
  tx: Tx,
  storeId: string,
  product: { id: string; title: string },
  options: ProductOptionInput[] | undefined,
  variants: ProductVariantInput[] | undefined,
  fallbackPriceCents?: number,
  fallbackCostCents?: number,
  fallbackCompareAt?: number
) {
  if (!options?.length && !variants?.length) {
    if (typeof fallbackPriceCents !== "number") {
      throw badRequest("priceCents is required for simple products", "PRICE_REQUIRED");
    }

    await tx.productVariant.create({
      data: {
        storeId,
        productId: product.id,
        title: product.title,
        priceCents: fallbackPriceCents,
        costCents: fallbackCostCents,
        compareAtPriceCents: fallbackCompareAt,
        isActive: true
      }
    });

    return;
  }

  if (!options || !variants) {
    throw badRequest("Both options and variants are required for variant products", "INVALID_VARIANTS");
  }

  validateVariantInput(options, variants);

  const optionMap = new Map<string, { id: string; values: Map<string, string> }>();

  for (let optionIndex = 0; optionIndex < options.length; optionIndex += 1) {
    const optionInput = options[optionIndex];

    const option = await tx.productOption.create({
      data: {
        storeId,
        productId: product.id,
        name: optionInput.name,
        position: optionInput.position ?? optionIndex
      }
    });

    const valuesMap = new Map<string, string>();

    for (let valueIndex = 0; valueIndex < optionInput.values.length; valueIndex += 1) {
      const valueInput = optionInput.values[valueIndex];
      const optionValue = await tx.productOptionValue.create({
        data: {
          storeId,
          optionId: option.id,
          value: valueInput.value,
          position: valueInput.position ?? valueIndex
        }
      });

      valuesMap.set(valueInput.value.trim().toLowerCase(), optionValue.id);
    }

    optionMap.set(optionInput.name.trim().toLowerCase(), { id: option.id, values: valuesMap });
  }

  for (const variantInput of variants) {
    const variant = await tx.productVariant.create({
      data: {
        storeId,
        productId: product.id,
        sku: variantInput.sku,
        title: variantInput.title ?? product.title,
        priceCents: variantInput.priceCents,
        costCents: variantInput.costCents,
        compareAtPriceCents: variantInput.compareAtPriceCents,
        isActive: variantInput.isActive ?? true
      }
    });

    const links: Array<{ storeId: string; variantId: string; optionValueId: string }> = [];
    for (const selection of variantInput.selections ?? []) {
      const option = optionMap.get(selection.optionName.trim().toLowerCase());
      if (!option) {
        throw badRequest(`Unknown option ${selection.optionName}`, "INVALID_VARIANTS");
      }

      const optionValueId = option.values.get(selection.value.trim().toLowerCase());
      if (!optionValueId) {
        throw badRequest(`Unknown option value ${selection.value} for option ${selection.optionName}`, "INVALID_VARIANTS");
      }

      links.push({
        storeId,
        variantId: variant.id,
        optionValueId
      });
    }

    await tx.variantOptionValue.createMany({ data: links });
  }
}

export const catalogService = {
  async createCategory(storeId: string, input: CategoryInput) {
    return db.$transaction(async (tx: Tx) => {
      const slug = await generateUniqueSlug(tx, "category", storeId, input.name);

      const category = await tx.category.create({
        data: {
          storeId,
          name: input.name,
          slug,
          description: input.description,
          isActive: input.isActive ?? true,
          sortOrder: input.sortOrder ?? 0
        }
      });

      return mapCategory(category);
    });
  },

  async listAdminCategories(storeId: string) {
    const categories = await db.category.findMany({
      where: { storeId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }, { id: "asc" }]
    });

    return categories.map(mapCategory);
  },

  async updateCategory(storeId: string, id: string, input: Partial<CategoryInput>) {
    return db.$transaction(async (tx: Tx) => {
      const existing = await tx.category.findFirst({ where: { id, storeId } });
      if (!existing) {
        throw badRequest("Category not found", "CATEGORY_NOT_FOUND");
      }

      const slug = input.name ? await generateUniqueSlug(tx, "category", storeId, input.name, id) : existing.slug;

      const category = await tx.category.update({
        where: { id },
        data: {
          name: input.name ?? existing.name,
          slug,
          description: input.description === undefined ? existing.description : input.description,
          isActive: input.isActive ?? existing.isActive,
          sortOrder: input.sortOrder ?? existing.sortOrder
        }
      });

      return mapCategory(category);
    });
  },

  async deleteCategory(storeId: string, id: string) {
    const existing = await db.category.findFirst({ where: { id, storeId }, select: { id: true } });
    if (!existing) {
      throw badRequest("Category not found", "CATEGORY_NOT_FOUND");
    }

    await db.category.delete({ where: { id } });
    return { ok: true };
  },

  async createProduct(storeId: string, input: CreateProductInput) {
    return db.$transaction(async (tx: Tx) => {
      const slug = await generateUniqueSlug(tx, "product", storeId, input.title);

      const product = await tx.product.create({
        data: {
          storeId,
          title: input.title,
          slug,
          description: input.description,
          videoUrl: input.videoUrl,
          status: input.status,
          featured: input.featured ?? false,
          badges: (input.badges ?? []) as any,
          tags: (input.tags ?? []) as any
        }
      });

      await attachCategories(tx, storeId, product.id, input.categoryIds);
      await attachImages(tx, storeId, product.id, input.images);
      await createOptionsAndVariants(
        tx,
        storeId,
        { id: product.id, title: product.title },
        input.options,
        input.variants,
        input.priceCents,
        input.costCents,
        input.compareAtPriceCents
      );

      const created = await tx.product.findUnique({
        where: { id: product.id },
        include: adminProductInclude
      });

      if (!created) {
        throw badRequest("Product not found after creation", "PRODUCT_NOT_FOUND");
      }

      return mapProduct(created);
    });
  },

  async listAdminProducts(
    storeId: string,
    filters: {
      status?: ProductStatus;
      q?: string;
      page?: number;
      limit?: number;
    }
  ) {
    const { skip, take, page, limit } = normalizePagination(filters);

    const where: any = {
      storeId,
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.q
        ? {
            OR: [
              { title: { contains: filters.q, mode: "insensitive" } },
              { slug: { contains: filters.q, mode: "insensitive" } }
            ]
          }
        : {})
    };

    const [items, total] = await Promise.all([
      db.product.findMany({
        where,
        include: adminProductInclude,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip,
        take
      }),
      db.product.count({ where })
    ]);

    return {
      items: items.map(mapProduct),
      pagination: buildPaginationMeta(page, limit, total)
    };
  },

  async getAdminProductById(storeId: string, id: string) {
    const product = await db.product.findFirst({
      where: { id, storeId },
      include: adminProductInclude
    });

    if (!product) {
      throw badRequest("Product not found", "PRODUCT_NOT_FOUND");
    }

    return mapProduct(product);
  },

  async updateProduct(storeId: string, id: string, input: UpdateProductInput) {
    return db.$transaction(async (tx: Tx) => {
      const existing = await tx.product.findFirst({ where: { id, storeId } });
      if (!existing) {
        throw badRequest("Product not found", "PRODUCT_NOT_FOUND");
      }

      const slug = input.title ? await generateUniqueSlug(tx, "product", storeId, input.title, id) : existing.slug;

      await tx.product.update({
        where: { id },
        data: {
          title: input.title ?? existing.title,
          slug,
          description: input.description === undefined ? existing.description : input.description,
          videoUrl: input.videoUrl === undefined ? existing.videoUrl : input.videoUrl,
          status: input.status ?? existing.status,
          featured: input.featured ?? existing.featured,
          badges: input.badges === undefined ? existing.badges : ((input.badges ?? []) as any),
          tags: input.tags === undefined ? existing.tags : ((input.tags ?? []) as any)
        }
      });

      await attachCategories(tx, storeId, id, input.categoryIds);
      await attachImages(tx, storeId, id, input.images);

      const updated = await tx.product.findUnique({
        where: { id },
        include: adminProductInclude
      });

      if (!updated) {
        throw badRequest("Product not found", "PRODUCT_NOT_FOUND");
      }

      return mapProduct(updated);
    });
  },

  async deleteProduct(storeId: string, id: string) {
    return db.$transaction(async (tx: Tx) => {
      const existing = await tx.product.findFirst({ where: { id, storeId }, select: { id: true } });
      if (!existing) {
        throw badRequest("Product not found", "PRODUCT_NOT_FOUND");
      }

      await tx.product.update({
        where: { id },
        data: { status: "DRAFT" }
      });

      await tx.productVariant.updateMany({
        where: { storeId, productId: id },
        data: { isActive: false }
      });

      return { ok: true, archived: true };
    });
  },

  async setProductFeatured(storeId: string, id: string, featured: boolean) {
    const existing = await db.product.findFirst({ where: { id, storeId }, select: { id: true } });
    if (!existing) {
      throw badRequest("Product not found", "PRODUCT_NOT_FOUND");
    }

    const updated = await db.product.update({
      where: { id },
      data: { featured },
      include: adminProductInclude
    });

    return mapProduct(updated);
  },

  async replaceProductVariants(storeId: string, productId: string, input: ReplaceVariantsInput) {
    return db.$transaction(async (tx: Tx) => {
      const product = await tx.product.findFirst({ where: { id: productId, storeId } });
      if (!product) {
        throw badRequest("Product not found", "PRODUCT_NOT_FOUND");
      }

      validateVariantInput(input.options, input.variants);

      await tx.variantOptionValue.deleteMany({
        where: {
          storeId,
          variant: {
            productId
          }
        }
      });

      await tx.productVariant.deleteMany({ where: { storeId, productId } });
      await tx.productOptionValue.deleteMany({ where: { storeId, option: { productId } } });
      await tx.productOption.deleteMany({ where: { storeId, productId } });

      await createOptionsAndVariants(tx, storeId, { id: product.id, title: product.title }, input.options, input.variants);

      const updated = await tx.product.findUnique({
        where: { id: productId },
        include: adminProductInclude
      });

      if (!updated) {
        throw badRequest("Product not found", "PRODUCT_NOT_FOUND");
      }

      return mapProduct(updated);
    });
  },

  async updateVariant(storeId: string, id: string, input: UpdateVariantInput) {
    const variant = await db.productVariant.findFirst({ where: { id, storeId } });
    if (!variant) {
      throw badRequest("Variant not found", "VARIANT_NOT_FOUND");
    }

    const updated = await db.productVariant.update({
      where: { id },
      data: {
        sku: input.sku === undefined ? variant.sku : input.sku,
        title: input.title ?? variant.title,
        priceCents: input.priceCents ?? variant.priceCents,
        costCents: input.costCents === undefined ? variant.costCents : input.costCents,
        compareAtPriceCents:
          input.compareAtPriceCents === undefined ? variant.compareAtPriceCents : input.compareAtPriceCents,
        isActive: input.isActive ?? variant.isActive
      },
      include: {
        optionValues: {
          include: {
            optionValue: {
              include: {
                option: true
              }
            }
          }
        }
      }
    });

    return {
      id: updated.id,
      sku: updated.sku,
      title: updated.title,
      priceCents: updated.priceCents,
      costCents: updated.costCents,
      compareAtPriceCents: updated.compareAtPriceCents,
      isActive: updated.isActive,
      createdAt: updated.createdAt,
      selections: updated.optionValues.map((link: any) => ({
        optionName: link.optionValue.option.name,
        value: link.optionValue.value
      }))
    };
  },

  async deactivateVariant(storeId: string, id: string) {
    const variant = await db.productVariant.findFirst({ where: { id, storeId } });
    if (!variant) {
      throw badRequest("Variant not found", "VARIANT_NOT_FOUND");
    }

    await db.productVariant.update({
      where: { id },
      data: { isActive: false }
    });

    return { ok: true };
  },

  async listStoreCategories(storeId: string) {
    return db.category.findMany({
      where: {
        storeId,
        isActive: true
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }, { id: "asc" }],
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        sortOrder: true
      }
    });
  },

  async listStoreProducts(
    storeId: string,
    filters: {
      categorySlug?: string;
      q?: string;
      page?: number;
      limit?: number;
    }
  ) {
    const { skip, take, page, limit } = normalizePagination(filters);

    let categoryId: string | undefined;
    if (filters.categorySlug) {
      const category = await db.category.findFirst({
        where: {
          storeId,
          slug: filters.categorySlug,
          isActive: true
        },
        select: { id: true }
      });

      if (!category) {
        return {
          items: [],
          pagination: buildPaginationMeta(page, limit, 0)
        };
      }

      categoryId = category.id;
    }

    const where: any = {
      storeId,
      status: "ACTIVE",
      ...(filters.q
        ? {
            OR: [
              { title: { contains: filters.q, mode: "insensitive" } },
              { slug: { contains: filters.q, mode: "insensitive" } }
            ]
          }
        : {}),
      ...(categoryId
        ? {
            categories: {
              some: {
                categoryId
              }
            }
          }
        : {})
    };

    const [items, total] = await Promise.all([
      db.product.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip,
        take,
        include: {
          images: {
            orderBy: [{ sortOrder: "asc" }, { id: "asc" }]
          },
          variants: {
            where: { isActive: true },
            orderBy: [{ createdAt: "asc" }, { id: "asc" }]
            ,
            include: {
              inventoryLevels: {
                select: {
                  onHand: true,
                  reserved: true
                }
              }
            }
          },
          categories: {
            include: {
              category: {
                select: {
                  id: true,
                  name: true,
                  slug: true
                }
              }
            }
          }
        }
      }),
      db.product.count({ where })
    ]);

    return {
      items: items.map((item: any) => ({
        id: item.id,
        title: item.title,
        slug: item.slug,
        description: item.description,
        videoUrl: item.videoUrl,
        featured: Boolean(item.featured),
        badges: Array.isArray(item.badges) ? item.badges : [],
        tags: Array.isArray(item.tags) ? item.tags : [],
        images: item.images.map((image: any) => ({
          id: image.id,
          url: image.url,
          alt: image.alt,
          sortOrder: image.sortOrder
        })),
        categories: item.categories.map((link: any) => link.category),
        variants: item.variants.map((variant: any) => ({
          id: variant.id,
          title: variant.title,
          sku: variant.sku,
          priceCents: variant.priceCents,
          compareAtPriceCents: variant.compareAtPriceCents,
          onHand: (variant.inventoryLevels || []).reduce((sum: number, level: any) => sum + (level.onHand ?? 0), 0),
          reserved: (variant.inventoryLevels || []).reduce((sum: number, level: any) => sum + (level.reserved ?? 0), 0),
          available: (variant.inventoryLevels || []).reduce(
            (sum: number, level: any) => sum + ((level.onHand ?? 0) - (level.reserved ?? 0)),
            0
          )
        }))
      })),
      pagination: buildPaginationMeta(page, limit, total)
    };
  },

  async getStoreProductBySlug(storeId: string, slug: string) {
    const product = await db.product.findFirst({
      where: {
        storeId,
        slug,
        status: "ACTIVE"
      },
      include: {
        images: {
          orderBy: [{ sortOrder: "asc" }, { id: "asc" }]
        },
        options: {
          orderBy: [{ position: "asc" }, { id: "asc" }],
          include: {
            values: {
              orderBy: [{ position: "asc" }, { id: "asc" }]
            }
          }
        },
        variants: {
          where: { isActive: true },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          include: {
            inventoryLevels: {
              select: {
                onHand: true,
                reserved: true
              }
            },
            optionValues: {
              include: {
                optionValue: {
                  include: {
                    option: true
                  }
                }
              }
            }
          }
        },
        categories: {
          include: {
            category: {
              select: {
                id: true,
                name: true,
                slug: true
              }
            }
          }
        }
      }
    });

    if (!product) {
      throw badRequest("Product not found", "PRODUCT_NOT_FOUND");
    }

    return {
      id: product.id,
      title: product.title,
      slug: product.slug,
      description: product.description,
      videoUrl: product.videoUrl,
      featured: Boolean(product.featured),
      badges: Array.isArray(product.badges) ? product.badges : [],
      tags: Array.isArray(product.tags) ? product.tags : [],
      images: product.images.map((image: any) => ({
        id: image.id,
        url: image.url,
        alt: image.alt,
        sortOrder: image.sortOrder
      })),
      categories: product.categories.map((link: any) => link.category),
      options: product.options.map((option: any) => ({
        id: option.id,
        name: option.name,
        position: option.position,
        values: option.values.map((value: any) => ({
          id: value.id,
          value: value.value,
          position: value.position
        }))
      })),
      variants: product.variants.map((variant: any) => ({
        id: variant.id,
        title: variant.title,
        sku: variant.sku,
        priceCents: variant.priceCents,
        compareAtPriceCents: variant.compareAtPriceCents,
        onHand: (variant.inventoryLevels || []).reduce((sum: number, level: any) => sum + (level.onHand ?? 0), 0),
        reserved: (variant.inventoryLevels || []).reduce((sum: number, level: any) => sum + (level.reserved ?? 0), 0),
        available: (variant.inventoryLevels || []).reduce(
          (sum: number, level: any) => sum + ((level.onHand ?? 0) - (level.reserved ?? 0)),
          0
        ),
        selections: variant.optionValues.map((link: any) => ({
          optionName: link.optionValue.option.name,
          value: link.optionValue.value
        }))
      }))
    };
  }
};
