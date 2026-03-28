import { prisma } from "@ecom/db";
import { badRequest } from "../lib/errors.js";

const db = prisma as any;

const DEFAULT_THEME = {
  primaryColor: "#E8551A",
  secondaryColor: "#1A1D2E",
  buttonColor: "#E8551A",
  headerBgColor: "#0E1117",
  font: "Space Grotesk",
  tagline: "Premium fireworks for unforgettable nights.",
  showFeaturedSection: true,
  showCategorySection: true,
  showNewsletterSection: true,
  sectionOrder: ["hero", "featured", "categories", "newsletter"] as string[]
};

const DEFAULT_PAGES = [
  {
    slug: "about",
    title: "About Real Canadian Peptides",
    body: {
      subtitle: "Our Story",
      heading: "Canada's Trusted Source for Research Peptides",
      description:
        "We supply premium, HPLC-verified research peptides to scientists and institutions across Canada. Every product ships with a Certificate of Analysis so you can focus on discovery, not quality control."
    }
  },
  {
    slug: "contact",
    title: "Contact Us",
    body: {
      subtitle: "Get in Touch",
      heading: "Contact Us",
      description: "We're here to help. Reach out and we'll respond within one business day."
    }
  }
];

const DEFAULT_FAQS = [
  {
    question: "Do you ship across Canada?",
    answer:
      "Yes. We ship to all provinces and territories across Canada. Remote areas may have longer delivery times.",
    sortOrder: 1
  },
  {
    question: "Are your fireworks legal?",
    answer:
      "All products comply with Canadian regulations. Always check your local municipal bylaws before use.",
    sortOrder: 2
  },
  {
    question: "What is your return policy?",
    answer:
      "Opened fireworks cannot be returned. Unopened items in original packaging may be returned within 30 days.",
    sortOrder: 3
  }
];

function mapFaq(item: any) {
  return {
    id: item.id,
    question: item.question,
    answer: item.answer,
    sortOrder: item.sortOrder,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt
  };
}

function mapTheme(item: any) {
  return {
    primaryColor: item.primaryColor,
    secondaryColor: item.secondaryColor,
    buttonColor: item.buttonColor,
    headerBgColor: item.headerBgColor,
    font: item.font,
    tagline: item.tagline,
    showFeaturedSection: item.showFeaturedSection,
    showCategorySection: item.showCategorySection,
    showNewsletterSection: item.showNewsletterSection,
    sectionOrder: Array.isArray(item.sectionOrder) ? item.sectionOrder : DEFAULT_THEME.sectionOrder
  };
}

async function ensureDefaults(storeId: string) {
  const [faqCount] = await Promise.all([db.faq.count({ where: { storeId } })]);
  if (faqCount === 0) {
    await db.faq.createMany({
      data: DEFAULT_FAQS.map((faq) => ({
        storeId,
        question: faq.question,
        answer: faq.answer,
        sortOrder: faq.sortOrder
      }))
    });
  }

  await db.themeSetting.upsert({
    where: { storeId },
    create: {
      storeId,
      ...DEFAULT_THEME,
      sectionOrder: DEFAULT_THEME.sectionOrder as any
    },
    update: {}
  });

  for (const page of DEFAULT_PAGES) {
    await db.pageContent.upsert({
      where: { storeId_slug: { storeId, slug: page.slug } },
      create: {
        storeId,
        slug: page.slug,
        title: page.title,
        body: page.body as any
      },
      update: {}
    });
  }
}

export const contentService = {
  async ensureDefaults(storeId: string) {
    await ensureDefaults(storeId);
  },

  async listFaqs(storeId: string) {
    await ensureDefaults(storeId);
    const items = await db.faq.findMany({
      where: { storeId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }, { id: "asc" }]
    });
    return items.map(mapFaq);
  },

  async createFaq(storeId: string, input: { question: string; answer: string; sortOrder?: number }) {
    const created = await db.faq.create({
      data: {
        storeId,
        question: input.question,
        answer: input.answer,
        sortOrder: input.sortOrder ?? 0
      }
    });
    return mapFaq(created);
  },

  async updateFaq(storeId: string, id: string, input: { question?: string; answer?: string; sortOrder?: number }) {
    const existing = await db.faq.findFirst({ where: { id, storeId } });
    if (!existing) {
      throw badRequest("FAQ not found", "FAQ_NOT_FOUND");
    }

    const updated = await db.faq.update({
      where: { id },
      data: {
        question: input.question ?? existing.question,
        answer: input.answer ?? existing.answer,
        sortOrder: input.sortOrder ?? existing.sortOrder
      }
    });
    return mapFaq(updated);
  },

  async deleteFaq(storeId: string, id: string) {
    const existing = await db.faq.findFirst({ where: { id, storeId }, select: { id: true } });
    if (!existing) {
      throw badRequest("FAQ not found", "FAQ_NOT_FOUND");
    }
    await db.faq.delete({ where: { id } });
    return { ok: true };
  },

  async getTheme(storeId: string) {
    await ensureDefaults(storeId);
    const theme = await db.themeSetting.findUnique({ where: { storeId } });
    if (!theme) {
      throw badRequest("Theme not found", "THEME_NOT_FOUND");
    }
    return mapTheme(theme);
  },

  async updateTheme(storeId: string, input: Partial<typeof DEFAULT_THEME>) {
    await ensureDefaults(storeId);
    const existing = await db.themeSetting.findUnique({ where: { storeId } });
    if (!existing) {
      throw badRequest("Theme not found", "THEME_NOT_FOUND");
    }

    const updated = await db.themeSetting.update({
      where: { id: existing.id },
      data: {
        primaryColor: input.primaryColor ?? existing.primaryColor,
        secondaryColor: input.secondaryColor ?? existing.secondaryColor,
        buttonColor: input.buttonColor ?? existing.buttonColor,
        headerBgColor: input.headerBgColor ?? existing.headerBgColor,
        font: input.font ?? existing.font,
        tagline: input.tagline ?? existing.tagline,
        showFeaturedSection: input.showFeaturedSection ?? existing.showFeaturedSection,
        showCategorySection: input.showCategorySection ?? existing.showCategorySection,
        showNewsletterSection: input.showNewsletterSection ?? existing.showNewsletterSection,
        sectionOrder: (input.sectionOrder ?? existing.sectionOrder) as any
      }
    });

    return mapTheme(updated);
  },

  async getPage(storeId: string, slug: string) {
    await ensureDefaults(storeId);
    const page = await db.pageContent.findUnique({
      where: {
        storeId_slug: { storeId, slug }
      }
    });
    if (!page) {
      throw badRequest("Page not found", "PAGE_NOT_FOUND");
    }
    return {
      id: page.id,
      slug: page.slug,
      title: page.title,
      body: page.body,
      updatedAt: page.updatedAt
    };
  }
};
