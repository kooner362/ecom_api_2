CREATE TABLE "StoreSetting" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "email" TEXT,
  "currency" TEXT NOT NULL DEFAULT 'CAD',
  "timezone" TEXT NOT NULL DEFAULT 'America/Toronto',
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StoreSetting_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StoreSetting_storeId_key" ON "StoreSetting"("storeId");

ALTER TABLE "StoreSetting" ADD CONSTRAINT "StoreSetting_storeId_fkey"
FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
