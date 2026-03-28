import fs from "node:fs/promises";
import path from "node:path";
import { prisma } from "@ecom/db";

type CategoryRecord = {
  name: string;
  slug: string;
  url: string;
};

type ProductRecord = {
  slug: string;
  url: string;
  title: string;
  description: string;
  priceCents: number;
  compareAtPriceCents: number | null;
  currency: string;
  images: string[];
  videoUrl: string | null;
  categorySlugs: string[];
};

type FailedProductRecord = {
  slug: string;
  url: string;
  reason: string;
};

const BASE_URL = "https://www.pyrobobs.ca";
const ALL_PRODUCTS_URL = `${BASE_URL}/category/all-products`;
const OUT_DIR = path.resolve(process.cwd(), "data");
const OUT_JSON = path.join(OUT_DIR, "pyrobobs-export.json");
const OUT_CATEGORIES_CSV = path.join(OUT_DIR, "pyrobobs-categories.csv");
const OUT_PRODUCTS_CSV = path.join(OUT_DIR, "pyrobobs-products.csv");
const OUT_FAILED_JSON = path.join(OUT_DIR, "pyrobobs-failed-products.json");
const DEFAULT_PRODUCT_TIMEOUT_MS = 60000;
const DEFAULT_FETCH_TIMEOUT_MS = 20000;

function toSlug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function parseMoneyToCents(value: string): number {
  const cleaned = value.replace(/[^0-9.]/g, "");
  if (!cleaned) return 0;
  const num = Number.parseFloat(cleaned);
  if (!Number.isFinite(num)) return 0;
  return Math.round(num * 100);
}

function csvCell(value: string | number | null | undefined): string {
  const raw = value == null ? "" : String(value);
  if (raw.includes(",") || raw.includes('"') || raw.includes("\n")) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

function getArgValue(name: string): string | null {
  const prefix = `${name}=`;
  const arg = process.argv.find((entry) => entry.startsWith(prefix));
  if (!arg) return null;
  return arg.slice(prefix.length);
}

function getArgNumber(name: string, fallback: number): number {
  const raw = getArgValue(name);
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}

async function withTimeout<T>(task: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timeoutHandle: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([task, timeoutPromise]);
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }
}

async function fetchTextWithTimeout(url: string, timeoutMs: number, headers?: Record<string, string>): Promise<string> {
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      headers,
      signal: controller.signal
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.text();
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Fetch timeout after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutHandle);
  }
}

function parseLdJsonProduct(html: string): {
  title: string;
  description: string;
  images: string[];
  currency: string;
  offerPriceCents: number;
} | null {
  const re = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;

  while ((match = re.exec(html)) !== null) {
    const text = match[1]?.trim();
    if (!text) continue;
    try {
      const parsed = JSON.parse(text) as any;
      const node = Array.isArray(parsed) ? parsed[0] : parsed;
      if (!node || node["@type"] !== "Product") continue;
      const name = typeof node.name === "string" ? node.name.trim() : "";
      const description = typeof node.description === "string" ? node.description.trim() : "";
      const images: string[] = [];
      if (Array.isArray(node.image)) {
        for (const imageNode of node.image) {
          if (typeof imageNode === "string") {
            images.push(imageNode);
          } else if (imageNode && typeof imageNode.contentUrl === "string") {
            images.push(imageNode.contentUrl);
          }
        }
      }
      const offer = node.Offers || node.offers || {};
      const currency =
        typeof offer.priceCurrency === "string" && offer.priceCurrency.trim() ? offer.priceCurrency.trim() : "CAD";
      const offerPriceCents = parseMoneyToCents(typeof offer.price === "string" ? offer.price : String(offer.price ?? ""));
      return {
        title: name,
        description,
        images: Array.from(new Set(images)),
        currency,
        offerPriceCents
      };
    } catch {
      // ignore parse errors and continue scanning scripts
    }
  }

  return null;
}

function normalizeEscapedUrl(value: string): string {
  return value
    .replace(/&quot;/gi, "")
    .replace(/&#34;/gi, "")
    .replace(/\\u002F/gi, "/")
    .replace(/\\u003A/gi, ":")
    .replace(/%2F/gi, "/")
    .replace(/%3A/gi, ":")
    .replace(/\\\//g, "/")
    .replace(/&amp;/gi, "&")
    .replace(/^https:\/\//i, "https://")
    .replace(/^http:\/\//i, "http://")
    .trim();
}

function uniqueVideoCandidates(input: string[]): string[] {
  const out = new Set<string>();
  for (const raw of input) {
    const normalized = normalizeEscapedUrl(raw)
      .replace(/^"+|"+$/g, "")
      .replace(/^'+|'+$/g, "")
      .replace(/[),.;]+$/g, "")
      .trim();
    if (!normalized) continue;

    const add = (candidate: string) => {
      if (!/\.mp4(?:[?#].*)?$/i.test(candidate)) return;
      if (!/^https?:\/\//i.test(candidate)) return;
      out.add(candidate);
    };

    add(normalized);
    try {
      add(decodeURIComponent(normalized));
    } catch {
      // ignore decode errors
    }
  }
  return Array.from(out);
}

function extractMp4UrlsFromJsonLd(html: string): string[] {
  const urls = new Set<string>();
  const re = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;

  const walk = (value: unknown) => {
    if (typeof value === "string") {
      const normalized = normalizeEscapedUrl(value);
      if (/^https?:\/\//i.test(normalized) && /\.mp4(?:[?#][^"'\\s<>]*)?$/i.test(normalized)) {
        urls.add(normalized);
      }
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) walk(item);
      return;
    }
    if (value && typeof value === "object") {
      for (const item of Object.values(value)) walk(item);
    }
  };

  while ((match = re.exec(html)) !== null) {
    const text = match[1]?.trim();
    if (!text) continue;
    try {
      walk(JSON.parse(text));
    } catch {
      // ignore invalid json-ld
    }
  }

  return uniqueVideoCandidates(Array.from(urls));
}

function extractVideoUrl(html: string): string | null {
  const rawCandidates: string[] = [];
  rawCandidates.push(...extractMp4UrlsFromJsonLd(html));

  const patterns = [
    /https?:\/\/[^\s"'<>]+\.mp4(?:\?[^\s"'<>]*)?/gi,
    /https?:\\\/\\\/[^\s"'<>]+\.mp4(?:\?[^\s"'<>]*)?/gi,
    /https?:%2F%2F[^\s"'<>]+\.mp4(?:%3F[^\s"'<>]*)?/gi,
    /video\.wixstatic\.com\/[^\s"'<>]+\/mp4\/file\.mp4(?:\?[^\s"'<>]*)?/gi,
    /video\.wixstatic\.com\\\/[^\s"'<>]+\\\/mp4\\\/file\.mp4(?:\?[^\s"'<>]*)?/gi
  ];
  for (const pattern of patterns) {
    rawCandidates.push(...(html.match(pattern) || []));
  }

  const candidates = uniqueVideoCandidates(
    rawCandidates.map((value) => (value.startsWith("video.wixstatic.com") ? `https://${value}` : value))
  );
  return candidates[0] ?? null;
}

function extractRegularAndSale(html: string): { regularCents: number | null; saleCents: number | null } {
  const regularMatch = html.match(/Regular Price[^C]*C\$([0-9.,]+)/i);
  const saleMatch = html.match(/Sale Price[^C]*C\$([0-9.,]+)/i);
  return {
    regularCents: regularMatch ? parseMoneyToCents(regularMatch[1]) : null,
    saleCents: saleMatch ? parseMoneyToCents(saleMatch[1]) : null
  };
}

async function parseProductWithPlaywrightFallback(
  page: any,
  url: string,
  slug: string,
  categorySlugs: string[]
): Promise<ProductRecord | null> {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForTimeout(1000);
  await page
    .waitForFunction(
      () => {
        const html = document.documentElement?.outerHTML || "";
        return /video\.wixstatic\.com\/video\/[^\s"'<>]+\/mp4\/file\.mp4/i.test(html) || html.toLowerCase().includes(".mp4");
      },
      { timeout: 7000 }
    )
    .catch(() => undefined);

  const extracted = await page.evaluate(() => {
    const title =
      document.querySelector("main h1")?.textContent?.trim() ||
      document.querySelector("h1")?.textContent?.trim() ||
      "";

    const ogDescription =
      document.querySelector('meta[property="og:description"]')?.getAttribute("content")?.trim() || "";
    const firstParagraph =
      Array.from(document.querySelectorAll("main p"))
        .map((el) => (el.textContent || "").trim())
        .find((text) => text.length > 20) || "";
    const description = ogDescription || firstParagraph;

    const text = document.body.innerText || "";
    const regularMatch = text.match(/Regular Price\s*C\$?\s*([0-9.,]+)/i);
    const saleMatch = text.match(/Sale Price\s*C\$?\s*([0-9.,]+)/i);
    const priceMatch = text.match(/(?:^|\n)\s*Price\s*C\$?\s*([0-9.,]+)/i);

    const imageUrls = new Set<string>();

    for (const script of Array.from(document.querySelectorAll('script[type="application/ld+json"]'))) {
      try {
        const parsed = JSON.parse(script.textContent || "null") as any;
        const node = Array.isArray(parsed) ? parsed[0] : parsed;
        if (node?.["@type"] === "Product" && Array.isArray(node.image)) {
          for (const imageNode of node.image) {
            if (typeof imageNode === "string") {
              imageUrls.add(imageNode);
            } else if (imageNode && typeof imageNode.contentUrl === "string") {
              imageUrls.add(imageNode.contentUrl);
            }
          }
        }
      } catch {
        // ignore invalid json-ld
      }
    }

    for (const img of Array.from(document.querySelectorAll("img"))) {
      const src = ((img as HTMLImageElement).currentSrc || (img as HTMLImageElement).src || "").trim();
      if (!src.includes("static.wixstatic.com/media/")) continue;
      if (/logo/i.test(src)) continue;
      imageUrls.add(src);
    }

    const videoUrls = new Set<string>();
    const html = document.documentElement.outerHTML || "";
    const directMatches = html.match(/https?:\/\/[^"'\\s<>]+\.mp4(?:\?[^"'\\s<>]*)?/gi) || [];
    for (const url of directMatches) {
      videoUrls.add(url);
    }
    const escapedMatches = html.match(/https?:\\\/\\\/[^"'\\s<>]+\.mp4(?:\?[^"'\\s<>]*)?/gi) || [];
    for (const raw of escapedMatches) {
      videoUrls.add(raw.replace(/\\u002F/gi, "/").replace(/\\u003A/gi, ":").replace(/\\\//g, "/").trim());
    }
    const hostOnlyMatches = html.match(/video\.wixstatic\.com\/video\/[^"'\\s<>]+\/mp4\/file\.mp4(?:\?[^"'\\s<>]*)?/gi) || [];
    for (const raw of hostOnlyMatches) {
      const normalized = raw.trim();
      videoUrls.add(normalized.startsWith("http") ? normalized : `https://${normalized}`);
    }

    for (const video of Array.from(document.querySelectorAll("video"))) {
      const el = video as HTMLVideoElement;
      const src = (el.currentSrc || el.src || "").trim();
      if (src.toLowerCase().includes(".mp4")) videoUrls.add(src);
      for (const source of Array.from(el.querySelectorAll("source"))) {
        const sourceSrc = (source.getAttribute("src") || "").trim();
        if (sourceSrc.toLowerCase().includes(".mp4")) {
          try {
            videoUrls.add(new URL(sourceSrc, window.location.href).toString());
          } catch {
            videoUrls.add(sourceSrc);
          }
        }
      }
    }

    for (const meta of Array.from(document.querySelectorAll('meta[property="og:video"], meta[name="og:video"]'))) {
      const content = (meta.getAttribute("content") || "").trim();
      if (content.toLowerCase().includes(".mp4")) videoUrls.add(content);
    }

    return {
      title,
      description,
      regularPrice: regularMatch ? regularMatch[1] : null,
      salePrice: saleMatch ? saleMatch[1] : null,
      anyPrice: priceMatch ? priceMatch[1] : null,
      images: Array.from(imageUrls),
      videoUrls: Array.from(videoUrls)
    };
  });

  if (!extracted.title) {
    return null;
  }

  const saleCents = extracted.salePrice ? parseMoneyToCents(extracted.salePrice) : null;
  const regularCents = extracted.regularPrice ? parseMoneyToCents(extracted.regularPrice) : null;
  const anyCents = extracted.anyPrice ? parseMoneyToCents(extracted.anyPrice) : null;
  const priceCents = saleCents ?? regularCents ?? anyCents ?? 0;
  const compareAtPriceCents =
    regularCents && saleCents && regularCents > saleCents ? regularCents : regularCents && !saleCents ? regularCents : null;

  return {
    slug,
    url,
    title: extracted.title,
    description: extracted.description || "",
    priceCents,
    compareAtPriceCents,
    currency: "CAD",
    images: extracted.images,
    videoUrl: extracted.videoUrls?.[0] || null,
    categorySlugs
  };
}

async function extractRenderedMediaWithPlaywright(
  page: any,
  url: string
): Promise<{ images: string[]; videoUrl: string | null }> {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => undefined);
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const hasVideoPattern = await page
      .evaluate(() => {
        const html = document.documentElement?.outerHTML || "";
        return (
          /video\.wixstatic\.com\/video\/[^\s"'<>]+\/mp4\/file\.mp4/i.test(html) ||
          /video\.wixstatic\.com\\\/video\\\/[^\s"'<>]+\\\/mp4\\\/file\.mp4/i.test(html) ||
          html.toLowerCase().includes(".mp4") ||
          document.querySelectorAll("video").length > 0
        );
      })
      .catch(() => false);
    if (hasVideoPattern) break;
    await page.waitForTimeout(500);
  }

  const extracted = await page.evaluate(() => {
    const imageUrls = new Set<string>();
    const videoUrls = new Set<string>();
    const html = document.documentElement?.outerHTML || "";

    for (const img of Array.from(document.querySelectorAll("img"))) {
      const src = ((img as HTMLImageElement).currentSrc || (img as HTMLImageElement).src || "").trim();
      if (!src.includes("static.wixstatic.com/media/")) continue;
      if (/logo/i.test(src)) continue;
      imageUrls.add(src);
    }

    const rawVideoMatches = [
      ...(html.match(/https?:\/\/[^"'\\s<>]+\.mp4(?:\?[^"'\\s<>]*)?/gi) || []),
      ...(html.match(/https?:\\\/\\\/[^"'\\s<>]+\.mp4(?:\?[^"'\\s<>]*)?/gi) || []),
      ...(html.match(/video\.wixstatic\.com\/video\/[^"'\\s<>]+\/mp4\/file\.mp4(?:\?[^"'\\s<>]*)?/gi) || []),
      ...(html.match(/video\.wixstatic\.com\\\/video\\\/[^"'\\s<>]+\\\/mp4\\\/file\.mp4(?:\?[^"'\\s<>]*)?/gi) || [])
    ];
    for (const raw of rawVideoMatches) {
      const normalized = raw
        .replace(/&quot;/gi, "")
        .replace(/&#34;/gi, "")
        .replace(/\\u002F/gi, "/")
        .replace(/\\u003A/gi, ":")
        .replace(/\\\//g, "/")
        .replace(/^https:\/\//i, "https://")
        .replace(/^http:\/\//i, "http://")
        .trim();
      videoUrls.add(normalized.startsWith("video.wixstatic.com") ? `https://${normalized}` : normalized);
    }

    // Wix often keeps media URLs in inline script payloads.
    for (const script of Array.from(document.querySelectorAll("script"))) {
      const text = (script.textContent || "").trim();
      if (!text) continue;
      const scriptMatches = [
        ...(text.match(/https?:\/\/[^"'\\s<>]+\.mp4(?:\?[^"'\\s<>]*)?/gi) || []),
        ...(text.match(/https?:\\\/\\\/[^"'\\s<>]+\.mp4(?:\?[^"'\\s<>]*)?/gi) || []),
        ...(text.match(/video\.wixstatic\.com(?:\\\/|\/)video(?:\\\/|\/)[^"'\\s<>]+(?:\\\/|\/)mp4(?:\\\/|\/)file\.mp4(?:\?[^"'\\s<>]*)?/gi) || [])
      ];
      for (const raw of scriptMatches) {
        const normalized = raw
          .replace(/&quot;/gi, "")
          .replace(/&#34;/gi, "")
          .replace(/\\u002F/gi, "/")
          .replace(/\\u003A/gi, ":")
          .replace(/\\\//g, "/")
          .replace(/^https:\/\//i, "https://")
          .replace(/^http:\/\//i, "http://")
          .trim();
        const withScheme = normalized.startsWith("video.wixstatic.com") ? `https://${normalized}` : normalized;
        if (/\.mp4(?:[?#].*)?$/i.test(withScheme) && /^https?:\/\//i.test(withScheme)) {
          videoUrls.add(withScheme);
        }
      }
    }

    for (const video of Array.from(document.querySelectorAll("video"))) {
      const el = video as HTMLVideoElement;
      const src = (el.currentSrc || el.src || "").trim();
      if (src.toLowerCase().includes(".mp4")) videoUrls.add(src);
      for (const source of Array.from(el.querySelectorAll("source"))) {
        const sourceSrc = (source.getAttribute("src") || "").trim();
        if (sourceSrc.toLowerCase().includes(".mp4")) {
          try {
            videoUrls.add(new URL(sourceSrc, window.location.href).toString());
          } catch {
            videoUrls.add(sourceSrc);
          }
        }
      }
    }

    for (const meta of Array.from(document.querySelectorAll('meta[property="og:video"], meta[name="og:video"]'))) {
      const content = (meta.getAttribute("content") || "").trim();
      if (content.toLowerCase().includes(".mp4")) videoUrls.add(content);
    }

    const filteredVideos = Array.from(videoUrls).filter(
      (value) => /^https?:\/\//i.test(value) && /\.mp4(?:[?#].*)?$/i.test(value)
    );

    return {
      images: Array.from(imageUrls),
      videoUrls: filteredVideos
    };
  });

  return {
    images: extracted.images || [],
    videoUrl: (extracted.videoUrls || [])[0] || null
  };
}

async function scrapePyroBobs() {
  let playwright: any;
  try {
    playwright = await import("playwright");
  } catch {
    throw new Error(
      "Missing dependency: playwright. Install it once with `npm i -D playwright` before running import."
    );
  }
  const browser = await playwright.chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const categoryMap = new Map<string, CategoryRecord>();
  const productToCategories = new Map<string, Set<string>>();
  const singleProductArg = process.argv.find((arg) => arg.startsWith("--single-product="));
  const singleProduct = singleProductArg ? singleProductArg.split("=").slice(1).join("=") : null;
  const debugVideo = hasFlag("--debug-video");
  const verbose = hasFlag("--verbose");
  const productTimeoutMs = getArgNumber("--product-timeout-ms", DEFAULT_PRODUCT_TIMEOUT_MS);
  const fetchTimeoutMs = getArgNumber("--fetch-timeout-ms", DEFAULT_FETCH_TIMEOUT_MS);
  const log = (message: string) => {
    if (verbose) {
      // eslint-disable-next-line no-console
      console.log(`[import:pyrobobs] ${message}`);
    }
  };
  const startMs = Date.now();

  try {
    log(
      `start scrape singleProduct=${singleProduct ?? "none"} productTimeoutMs=${productTimeoutMs} fetchTimeoutMs=${fetchTimeoutMs}`
    );
    if (!singleProduct) {
      await page.goto(ALL_PRODUCTS_URL, { waitUntil: "domcontentloaded", timeout: 120000 });
      log(`loaded category index: ${ALL_PRODUCTS_URL}`);

      const categories = await page.$$eval('a[href*="/category/"]', (anchors) =>
        anchors
          .map((a) => ({
            href: (a as HTMLAnchorElement).href,
            name: (a.textContent || "").trim()
          }))
          .filter((item) => item.href.includes("/category/") && item.name.length > 0)
      );

      for (const category of categories) {
        try {
          const url = new URL(category.href);
          const slug = url.pathname.split("/").filter(Boolean).pop() || "";
          if (!slug || slug === "all-products") continue;
          if (!categoryMap.has(slug)) {
            categoryMap.set(slug, {
              name: category.name,
              slug,
              url: `${BASE_URL}/category/${slug}`
            });
          }
        } catch {
          // ignore malformed URLs
        }
      }
      log(`discovered categories: ${categoryMap.size}`);

      const categoriesToVisit = Array.from(categoryMap.values());
      let categoryIndex = 0;
      for (const category of categoriesToVisit) {
        categoryIndex += 1;
        log(`category ${categoryIndex}/${categoriesToVisit.length}: ${category.slug}`);
        await page.goto(category.url, { waitUntil: "domcontentloaded", timeout: 120000 });

        let guard = 0;
        while (guard < 200) {
          guard += 1;
          const loadMoreButton = page.getByRole("button", { name: "Load More" });
          const visible = await loadMoreButton.isVisible().catch(() => false);
          if (!visible) break;
          await loadMoreButton.click().catch(() => undefined);
          await page.waitForTimeout(250);
        }
        if (guard > 1) {
          log(`category ${category.slug}: load-more clicks=${guard - 1}`);
        }

        const productLinks = await page.$$eval('a[href*="/product-page/"]', (anchors) =>
          Array.from(
            new Set(
              anchors
                .map((a) => (a as HTMLAnchorElement).href)
                .filter((href) => href.includes("/product-page/"))
            )
          )
        );

        for (const href of productLinks) {
          try {
            const url = new URL(href);
            const slug = url.pathname.split("/").filter(Boolean).pop() || "";
            if (!slug) continue;
            if (!productToCategories.has(slug)) {
              productToCategories.set(slug, new Set<string>());
            }
            productToCategories.get(slug)?.add(category.slug);
          } catch {
            // ignore malformed URLs
          }
        }
        log(`category ${category.slug}: products discovered=${productLinks.length}`);
      }
    } else {
      const slug = singleProduct.replace(/^https?:\/\/www\.pyrobobs\.ca\/product-page\//i, "").trim();
      productToCategories.set(slug, new Set<string>());
      log(`single-product mode: ${slug}`);
    }

    const products: ProductRecord[] = [];
    const failedProducts: FailedProductRecord[] = [];
    const slugs = (singleProduct
      ? [singleProduct.replace(/^https?:\/\/www\.pyrobobs\.ca\/product-page\//i, "").trim()]
      : Array.from(productToCategories.keys()).sort((a, b) => a.localeCompare(b)));
    log(`products queued: ${slugs.length}`);
    for (const slug of slugs) {
      const productStart = Date.now();
      const url = `${BASE_URL}/product-page/${slug}`;
      const categorySlugs = Array.from(productToCategories.get(slug) || []).sort((a, b) => a.localeCompare(b));
      log(`product start: ${slug} categories=${categorySlugs.length}`);

      try {
        await withTimeout(
          (async () => {
            let html: string | null = null;
            let lastFetchError: string | null = null;

            for (let attempt = 1; attempt <= 3; attempt += 1) {
              try {
                log(`product ${slug}: fetch attempt ${attempt}/3`);
                html = await fetchTextWithTimeout(url, fetchTimeoutMs, {
                  "User-Agent": "Mozilla/5.0 (compatible; ecom-importer/1.0)"
                });
                log(`product ${slug}: fetch ok`);
                break;
              } catch (error) {
                lastFetchError = error instanceof Error ? error.message : "Unknown fetch error";
                log(`product ${slug}: fetch failed attempt ${attempt}/3 reason=${lastFetchError}`);
                if (attempt < 3) {
                  await page.waitForTimeout(300 * attempt);
                }
              }
            }

            if (!html) {
              log(`product ${slug}: using playwright full fallback (no fetch html)`);
              const fallback = await parseProductWithPlaywrightFallback(page, url, slug, categorySlugs);
              if (!fallback) {
                throw new Error(lastFetchError ? `Fetch failed after retries: ${lastFetchError}` : "Fetch failed after retries");
              }
              products.push(fallback);
              log(`product ${slug}: fallback success video=${fallback.videoUrl ? "yes" : "no"} images=${fallback.images.length}`);
              return;
            }

            const ld = parseLdJsonProduct(html);

            if (!ld) {
              log(`product ${slug}: JSON-LD missing, using playwright full fallback`);
              const fallback = await parseProductWithPlaywrightFallback(page, url, slug, categorySlugs);
              if (!fallback) {
                throw new Error("Unable to parse product from JSON-LD or DOM fallback");
              }
              products.push(fallback);
              log(`product ${slug}: fallback success video=${fallback.videoUrl ? "yes" : "no"} images=${fallback.images.length}`);
              return;
            }

            const pricing = extractRegularAndSale(html);
            const salePrice = pricing.saleCents ?? (ld.offerPriceCents > 0 ? ld.offerPriceCents : null);
            const regularPrice = pricing.regularCents ?? null;
            const priceCents = salePrice ?? regularPrice ?? 0;
            const compareAtPriceCents =
              regularPrice && salePrice && regularPrice > salePrice ? regularPrice : regularPrice && !salePrice ? regularPrice : null;
            let videoUrl = extractVideoUrl(html);
            let images = ld.images;

            // Wix often injects video/media only after hydration, so always verify media from rendered DOM.
            const renderedMedia = await extractRenderedMediaWithPlaywright(page, url);
            if (debugVideo) {
              // eslint-disable-next-line no-console
              console.log(
                `[import:pyrobobs][video] ${slug} raw=${videoUrl ?? "null"} rendered=${renderedMedia.videoUrl ?? "null"}`
              );
            }
            if (!videoUrl && renderedMedia.videoUrl) {
              videoUrl = renderedMedia.videoUrl;
            }
            if (images.length === 0 && renderedMedia.images.length > 0) {
              images = renderedMedia.images;
            }
            log(
              `product ${slug}: media resolved images=${images.length} video=${videoUrl ? "yes" : "no"}`
            );

            products.push({
              slug,
              url,
              title: ld.title || slug,
              description: ld.description || "",
              priceCents,
              compareAtPriceCents,
              currency: ld.currency || "CAD",
              images,
              videoUrl,
              categorySlugs
            });
            if (debugVideo) {
              // eslint-disable-next-line no-console
              console.log(`[import:pyrobobs][video] ${slug} final=${videoUrl ?? "null"}`);
            }
          })(),
          productTimeoutMs,
          `Product scrape ${slug}`
        );
        log(`product done: ${slug} (${Date.now() - productStart}ms)`);
      } catch (error) {
        const reason = error instanceof Error ? error.message : "Unknown scrape error";
        failedProducts.push({ slug, url, reason });
        // eslint-disable-next-line no-console
        console.warn(`[import:pyrobobs] failed product ${slug}: ${reason}`);
        log(`product failed: ${slug} (${Date.now() - productStart}ms)`);
      }
    }

    const categoriesOut = Array.from(categoryMap.values()).sort((a, b) => a.name.localeCompare(b.name));

    return {
      source: BASE_URL,
      scrapedAt: new Date().toISOString(),
      counts: {
        categories: categoriesOut.length,
        products: products.length,
        failedProducts: failedProducts.length
      },
      categories: categoriesOut,
      products,
      failedProducts
    };
  } finally {
    log(`scrape finished in ${Date.now() - startMs}ms`);
    await context.close();
    await browser.close();
  }
}

async function writeOutputs(data: Awaited<ReturnType<typeof scrapePyroBobs>>) {
  const verbose = hasFlag("--verbose");
  const log = (message: string) => {
    if (verbose) {
      // eslint-disable-next-line no-console
      console.log(`[import:pyrobobs] ${message}`);
    }
  };
  log("writing output files...");
  await fs.mkdir(OUT_DIR, { recursive: true });
  await fs.writeFile(OUT_JSON, JSON.stringify(data, null, 2), "utf8");

  const categoryCsv = [
    ["slug", "name", "url"].join(","),
    ...data.categories.map((c) => [csvCell(c.slug), csvCell(c.name), csvCell(c.url)].join(","))
  ].join("\n");
  await fs.writeFile(OUT_CATEGORIES_CSV, `${categoryCsv}\n`, "utf8");

  const productsCsv = [
    ["slug", "title", "price_cents", "compare_at_cents", "currency", "video_url", "image_count", "categories", "url"].join(","),
    ...data.products.map((p) =>
      [
        csvCell(p.slug),
        csvCell(p.title),
        csvCell(p.priceCents),
        csvCell(p.compareAtPriceCents),
        csvCell(p.currency),
        csvCell(p.videoUrl),
        csvCell(p.images.length),
        csvCell(p.categorySlugs.join("|")),
        csvCell(p.url)
      ].join(",")
    )
  ].join("\n");
  await fs.writeFile(OUT_PRODUCTS_CSV, `${productsCsv}\n`, "utf8");
  await fs.writeFile(OUT_FAILED_JSON, JSON.stringify(data.failedProducts || [], null, 2), "utf8");
  log(`wrote ${OUT_JSON}`);
  log(`wrote ${OUT_CATEGORIES_CSV}`);
  log(`wrote ${OUT_PRODUCTS_CSV}`);
  log(`wrote ${OUT_FAILED_JSON}`);
}

async function upsertToDb(data: Awaited<ReturnType<typeof scrapePyroBobs>>) {
  const verbose = hasFlag("--verbose");
  const log = (message: string) => {
    if (verbose) {
      // eslint-disable-next-line no-console
      console.log(`[import:pyrobobs] ${message}`);
    }
  };
  const store = await prisma.store.findFirst({ select: { id: true } });
  if (!store) {
    throw new Error("No store found. Start API once to initialize store before importing.");
  }
  const storeId = store.id;
  log(`seeding into store=${storeId}`);

  const categoryIdBySlug = new Map<string, string>();
  let sortOrder = 1;
  for (const category of data.categories) {
    const upserted = await prisma.category.upsert({
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
        description: null,
        isActive: true,
        sortOrder: sortOrder++
      },
      update: {
        name: category.name,
        isActive: true
      },
      select: { id: true }
    });
    categoryIdBySlug.set(category.slug, upserted.id);
  }
  log(`categories upserted: ${data.categories.length}`);

  let seeded = 0;
  for (const product of data.products) {
    const categoryIds = product.categorySlugs.map((slug) => categoryIdBySlug.get(slug)).filter((id): id is string => Boolean(id));
    const tags = Array.from(new Set(["import:pyrobobs", ...product.categorySlugs]));
    const featured = product.categorySlugs.includes("featured-products") || product.categorySlugs.includes("bobs-featured");

    await prisma.$transaction(async (tx) => {
      const upsertedProduct = await tx.product.upsert({
        where: {
          storeId_slug: {
            storeId,
            slug: product.slug
          }
        },
        create: {
          storeId,
          title: product.title,
          slug: product.slug || toSlug(product.title),
          description: product.description || null,
          videoUrl: product.videoUrl,
          status: "ACTIVE",
          featured,
          badges: [],
          tags: tags as any
        },
        update: {
          title: product.title,
          description: product.description || null,
          videoUrl: product.videoUrl,
          status: "ACTIVE",
          featured,
          tags: tags as any
        },
        select: { id: true }
      });

      await tx.productImage.deleteMany({
        where: {
          storeId,
          productId: upsertedProduct.id
        }
      });

      if (product.images.length > 0) {
        await tx.productImage.createMany({
          data: product.images.map((url, idx) => ({
            storeId,
            productId: upsertedProduct.id,
            url,
            sortOrder: idx
          }))
        });
      }

      await tx.productCategory.deleteMany({
        where: {
          storeId,
          productId: upsertedProduct.id
        }
      });
      if (categoryIds.length > 0) {
        await tx.productCategory.createMany({
          data: categoryIds.map((categoryId) => ({
            storeId,
            productId: upsertedProduct.id,
            categoryId
          }))
        });
      }

      const variant = await tx.productVariant.findFirst({
        where: {
          storeId,
          productId: upsertedProduct.id
        },
        orderBy: [{ createdAt: "asc" }],
        select: { id: true }
      });

      if (variant) {
        await tx.productVariant.update({
          where: { id: variant.id },
          data: {
            title: product.title,
            priceCents: product.priceCents,
            compareAtPriceCents: product.compareAtPriceCents,
            isActive: true
          }
        });
      } else {
        await tx.productVariant.create({
          data: {
            storeId,
            productId: upsertedProduct.id,
            title: product.title,
            priceCents: product.priceCents,
            compareAtPriceCents: product.compareAtPriceCents,
            isActive: true
          }
        });
      }
    });
    seeded += 1;
    if (verbose && (seeded % 25 === 0 || seeded === data.products.length)) {
      log(`products seeded: ${seeded}/${data.products.length}`);
    }
  }
  log("seed complete");
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const scrapeOnly = args.has("--scrape-only");
  const seedOnly = args.has("--seed-only");

  if (scrapeOnly && seedOnly) {
    throw new Error("Use only one mode: --scrape-only or --seed-only");
  }

  let data: Awaited<ReturnType<typeof scrapePyroBobs>>;

  if (seedOnly) {
    const raw = await fs.readFile(OUT_JSON, "utf8");
    data = JSON.parse(raw) as Awaited<ReturnType<typeof scrapePyroBobs>>;
  } else {
    data = await scrapePyroBobs();
    await writeOutputs(data);
  }

  if (!scrapeOnly) {
    await upsertToDb(data);
  }

  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        ok: true,
        scrapeOnly,
        seedOnly,
        counts: data.counts,
        output: {
          json: OUT_JSON,
          categoriesCsv: OUT_CATEGORIES_CSV,
          productsCsv: OUT_PRODUCTS_CSV,
          failedJson: OUT_FAILED_JSON
        }
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
