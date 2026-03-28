#!/usr/bin/env bash
set -euo pipefail

API_URL="${API_URL:-http://localhost:3000}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@example.com}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-ChangeMe123!}"

parse_json_field() {
  local field="$1"
  node -e 'const fs=require("fs");const field=process.argv[1];const data=JSON.parse(fs.readFileSync(0,"utf8"));const value=data[field];if(value===undefined||value===null){process.exit(1)};process.stdout.write(String(value));' "$field"
}

echo "[1/6] Admin login"
ADMIN_LOGIN=$(curl -sS -X POST "$API_URL/admin/auth/login" \
  -H 'content-type: application/json' \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")
ADMIN_TOKEN=$(echo "$ADMIN_LOGIN" | parse_json_field accessToken)

echo "[2/6] Create category"
CATEGORY_RES=$(curl -sS -X POST "$API_URL/admin/categories" \
  -H 'content-type: application/json' \
  -H "authorization: Bearer $ADMIN_TOKEN" \
  -d '{"name":"Tops","description":"Topwear","isActive":true,"sortOrder":1}')
CATEGORY_ID=$(echo "$CATEGORY_RES" | parse_json_field id)

echo "[3/6] Create simple product"
SIMPLE_PRODUCT=$(curl -sS -X POST "$API_URL/admin/products" \
  -H 'content-type: application/json' \
  -H "authorization: Bearer $ADMIN_TOKEN" \
  -d "{\"title\":\"Basic Tee\",\"status\":\"ACTIVE\",\"priceCents\":1999,\"categoryIds\":[\"$CATEGORY_ID\"],\"images\":[{\"url\":\"https://example.com/basic-tee.jpg\",\"sortOrder\":0}]}")
SIMPLE_SLUG=$(echo "$SIMPLE_PRODUCT" | parse_json_field slug)

echo "[4/6] Create variant product"
VARIANT_PRODUCT=$(curl -sS -X POST "$API_URL/admin/products" \
  -H 'content-type: application/json' \
  -H "authorization: Bearer $ADMIN_TOKEN" \
  -d "{\"title\":\"Premium Hoodie\",\"status\":\"ACTIVE\",\"categoryIds\":[\"$CATEGORY_ID\"],\"options\":[{\"name\":\"Size\",\"values\":[{\"value\":\"S\"},{\"value\":\"M\"}]},{\"name\":\"Color\",\"values\":[{\"value\":\"Black\"},{\"value\":\"Gray\"}]}],\"variants\":[{\"title\":\"Hoodie S Black\",\"priceCents\":4999,\"selections\":[{\"optionName\":\"Size\",\"value\":\"S\"},{\"optionName\":\"Color\",\"value\":\"Black\"}]},{\"title\":\"Hoodie M Gray\",\"priceCents\":5199,\"selections\":[{\"optionName\":\"Size\",\"value\":\"M\"},{\"optionName\":\"Color\",\"value\":\"Gray\"}]}]}")
VARIANT_SLUG=$(echo "$VARIANT_PRODUCT" | parse_json_field slug)

echo "[5/6] Storefront products"
curl -sS "$API_URL/store/products?categorySlug=tops&page=1&limit=20"

echo

echo "[6/6] Storefront product by slug"
curl -sS "$API_URL/store/products/$SIMPLE_SLUG"
curl -sS "$API_URL/store/products/$VARIANT_SLUG"

echo

echo "Smoke catalog flow complete"
