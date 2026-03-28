#!/usr/bin/env bash
set -euo pipefail

API_URL="${API_URL:-http://localhost:3000}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@example.com}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-ChangeMe123!}"

parse_json_field() {
  local field="$1"
  node -e 'const fs=require("fs");const field=process.argv[1];const data=JSON.parse(fs.readFileSync(0,"utf8"));const value=data[field];if(value===undefined||value===null){process.exit(1)};process.stdout.write(String(value));' "$field"
}

echo "[1/7] Admin login"
ADMIN_LOGIN=$(curl -sS -X POST "$API_URL/admin/auth/login" \
  -H 'content-type: application/json' \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")
ADMIN_TOKEN=$(echo "$ADMIN_LOGIN" | parse_json_field accessToken)

echo "[2/7] Create category"
CATEGORY_RES=$(curl -sS -X POST "$API_URL/admin/categories" \
  -H 'content-type: application/json' \
  -H "authorization: Bearer $ADMIN_TOKEN" \
  -d '{"name":"Discounted Category","description":"Phase 5","isActive":true,"sortOrder":1}')
CATEGORY_ID=$(echo "$CATEGORY_RES" | parse_json_field id)

echo "[3/7] Create category discount"
CATEGORY_DISCOUNT=$(curl -sS -X POST "$API_URL/admin/discounts/category" \
  -H 'content-type: application/json' \
  -H "authorization: Bearer $ADMIN_TOKEN" \
  -d "{\"categoryId\":\"$CATEGORY_ID\",\"type\":\"PERCENT\",\"percentBps\":1500,\"enabled\":true}")
echo "$CATEGORY_DISCOUNT"

echo "[4/7] Create coupon"
COUPON=$(curl -sS -X POST "$API_URL/admin/discounts/coupons" \
  -H 'content-type: application/json' \
  -H "authorization: Bearer $ADMIN_TOKEN" \
  -d '{"code":"SAVE10","enabled":true,"type":"PERCENT","percentBps":1000,"minSubtotalCents":1000}')
echo "$COUPON"

echo "[5/7] Validate coupon"
COUPON_VALIDATION=$(curl -sS -X POST "$API_URL/store/checkout/validate-coupon" \
  -H 'content-type: application/json' \
  -d '{"code":"save10","subtotalCents":5000}')
echo "$COUPON_VALIDATION"

echo "[6/7] Compute best discount via internal service"
CATEGORY_ID="$CATEGORY_ID" node --import tsx -e '
import { prisma } from "@ecom/db";
import { discountService } from "./apps/api/src/services/discountService.ts";

const store = await prisma.store.findFirst({ orderBy: { createdAt: "asc" } });
if (!store) throw new Error("Store not found");

const categoryId = process.env.CATEGORY_ID;
if (!categoryId) throw new Error("CATEGORY_ID missing");

const result = await discountService.computeBestDiscount(
  store.id,
  [
    {
      lineId: "line-1",
      categoryIds: [categoryId],
      subtotalCents: 6000
    }
  ],
  "SAVE10"
);

console.log(JSON.stringify(result, null, 2));
await prisma.$disconnect();
'

echo "[7/7] List coupons"
curl -sS "$API_URL/admin/discounts/coupons?q=SAVE&enabled=true" \
  -H "authorization: Bearer $ADMIN_TOKEN"
echo

echo "Smoke discounts flow complete"
