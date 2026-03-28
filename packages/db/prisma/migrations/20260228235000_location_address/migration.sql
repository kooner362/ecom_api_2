-- Add optional address to inventory locations for admin management UI
ALTER TABLE "Location"
ADD COLUMN "address" TEXT;
