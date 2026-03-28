-- Add CMS and product metadata tables/columns
ALTER TABLE "Product"
ADD COLUMN "badges" JSONB,
ADD COLUMN "tags" JSONB;

CREATE TABLE "Faq" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "question" TEXT NOT NULL,
  "answer" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Faq_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Faq_storeId_sortOrder_createdAt_idx"
ON "Faq"("storeId", "sortOrder", "createdAt");

ALTER TABLE "Faq"
ADD CONSTRAINT "Faq_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "PageContent" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PageContent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PageContent_storeId_slug_key"
ON "PageContent"("storeId", "slug");

CREATE INDEX "PageContent_storeId_slug_idx"
ON "PageContent"("storeId", "slug");

ALTER TABLE "PageContent"
ADD CONSTRAINT "PageContent_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ThemeSetting" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "primaryColor" TEXT NOT NULL,
  "secondaryColor" TEXT NOT NULL,
  "buttonColor" TEXT NOT NULL,
  "headerBgColor" TEXT NOT NULL,
  "font" TEXT NOT NULL,
  "tagline" TEXT NOT NULL,
  "showFeaturedSection" BOOLEAN NOT NULL DEFAULT true,
  "showCategorySection" BOOLEAN NOT NULL DEFAULT true,
  "showNewsletterSection" BOOLEAN NOT NULL DEFAULT true,
  "sectionOrder" JSONB NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ThemeSetting_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ThemeSetting_storeId_key"
ON "ThemeSetting"("storeId");

ALTER TABLE "ThemeSetting"
ADD CONSTRAINT "ThemeSetting_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
