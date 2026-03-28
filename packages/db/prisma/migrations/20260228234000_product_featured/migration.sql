-- Add featured flag to products for storefront merchandising
ALTER TABLE "Product"
ADD COLUMN "featured" BOOLEAN NOT NULL DEFAULT false;

-- Helpful for storefront/admin filtering by featured status
CREATE INDEX "Product_storeId_featured_status_createdAt_idx"
ON "Product"("storeId", "featured", "status", "createdAt");
