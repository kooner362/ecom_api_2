-- CreateEnum
CREATE TYPE "EmailRouteType" AS ENUM ('CUSTOMER_CONFIRMATION', 'PACKING', 'WAREHOUSE');

-- CreateEnum
CREATE TYPE "EmailRecipientKind" AS ENUM ('TO', 'CC', 'BCC');

-- CreateEnum
CREATE TYPE "EmailLogStatus" AS ENUM ('QUEUED', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "EmailRoute" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "type" "EmailRouteType" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "EmailRoute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailRecipient" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "kind" "EmailRecipientKind" NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailTemplate" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "html" TEXT NOT NULL,
    "text" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailLog" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "routeType" "EmailRouteType" NOT NULL,
    "status" "EmailLogStatus" NOT NULL,
    "providerMessageId" TEXT,
    "errorMessage" TEXT,
    "to" JSONB NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmailRoute_storeId_type_key" ON "EmailRoute"("storeId", "type");

-- CreateIndex
CREATE INDEX "EmailRoute_storeId_enabled_idx" ON "EmailRoute"("storeId", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "EmailRecipient_routeId_kind_email_key" ON "EmailRecipient"("routeId", "kind", "email");

-- CreateIndex
CREATE INDEX "EmailRecipient_storeId_routeId_kind_idx" ON "EmailRecipient"("storeId", "routeId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "EmailTemplate_routeId_key" ON "EmailTemplate"("routeId");

-- CreateIndex
CREATE INDEX "EmailTemplate_storeId_updatedAt_idx" ON "EmailTemplate"("storeId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "EmailLog_storeId_idempotencyKey_key" ON "EmailLog"("storeId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "EmailLog_storeId_orderId_routeType_createdAt_idx" ON "EmailLog"("storeId", "orderId", "routeType", "createdAt");

-- AddForeignKey
ALTER TABLE "EmailRoute" ADD CONSTRAINT "EmailRoute_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailRecipient" ADD CONSTRAINT "EmailRecipient_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailRecipient" ADD CONSTRAINT "EmailRecipient_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "EmailRoute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailTemplate" ADD CONSTRAINT "EmailTemplate_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailTemplate" ADD CONSTRAINT "EmailTemplate_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "EmailRoute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailLog" ADD CONSTRAINT "EmailLog_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailLog" ADD CONSTRAINT "EmailLog_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
