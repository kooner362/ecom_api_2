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

echo "[2/7] Ensure shipping methods exist"
curl -sS "$API_URL/admin/settings/shipping-methods" \
  -H "authorization: Bearer $ADMIN_TOKEN"
echo

echo "[3/7] Enable flat-rate shipping"
curl -sS -X PATCH "$API_URL/admin/settings/shipping-methods/FLAT_RATE" \
  -H 'content-type: application/json' \
  -H "authorization: Bearer $ADMIN_TOKEN" \
  -d '{"enabled":true,"name":"Standard Shipping","configJson":{"amountCents":1299}}'
echo

echo "[4/7] Enable local delivery with postal prefixes"
curl -sS -X PATCH "$API_URL/admin/settings/shipping-methods/LOCAL_DELIVERY" \
  -H 'content-type: application/json' \
  -H "authorization: Bearer $ADMIN_TOKEN" \
  -d '{"enabled":true,"name":"Local Delivery","configJson":{"amountCents":499,"postalPrefixes":["V3","V4"]}}'
echo

echo "[5/7] Create tax rate"
TAX_RATE=$(curl -sS -X POST "$API_URL/admin/tax-rates" \
  -H 'content-type: application/json' \
  -H "authorization: Bearer $ADMIN_TOKEN" \
  -d '{"name":"BC GST+PST","enabled":true,"country":"CA","province":"BC","rateBps":1200,"priority":10}')
echo "$TAX_RATE"
TAX_RATE_ID=$(echo "$TAX_RATE" | parse_json_field id)

echo "[6/7] Store shipping methods filtered by postal code"
curl -sS "$API_URL/store/checkout/shipping-methods?country=CA&province=BC&postalCode=V3A1A1"
echo

echo "[7/7] Tax preview"
curl -sS -X POST "$API_URL/store/checkout/tax-preview" \
  -H 'content-type: application/json' \
  -d '{"shippingAddress":{"country":"CA","province":"BC","postalCode":"V3A1A1"},"subtotalCents":10000,"shippingCents":1299,"discountCents":500}'
echo

echo "Created tax rate id: $TAX_RATE_ID"
echo "Smoke shipping/tax flow complete"
