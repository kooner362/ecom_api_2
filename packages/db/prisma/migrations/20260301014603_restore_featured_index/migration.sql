-- CreateIndex
CREATE INDEX "Product_storeId_featured_status_createdAt_idx" ON "Product"("storeId", "featured", "status", "createdAt");
