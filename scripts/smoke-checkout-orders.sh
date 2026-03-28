#!/usr/bin/env bash
set -euo pipefail

API_URL="${API_URL:-http://localhost:3000}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@example.com}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-ChangeMe123!}"
CUSTOMER_EMAIL="${CUSTOMER_EMAIL:-customer@example.com}"
CUSTOMER_PASSWORD="${CUSTOMER_PASSWORD:-ChangeMe123!}"
STRIPE_SECRET_KEY="${STRIPE_SECRET_KEY:-}"

parse_json_field() {
  local field="$1"
  node -e 'const fs=require("fs");const field=process.argv[1];const data=JSON.parse(fs.readFileSync(0,"utf8"));const value=data[field];if(value===undefined||value===null){process.exit(1)};process.stdout.write(String(value));' "$field"
}

echo "[1/11] Admin login"
ADMIN_LOGIN=$(curl -sS -X POST "$API_URL/admin/auth/login" \
  -H 'content-type: application/json' \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")
ADMIN_TOKEN=$(echo "$ADMIN_LOGIN" | parse_json_field accessToken)

echo "[2/11] Create category + product"
CATEGORY_ID=$(curl -sS -X POST "$API_URL/admin/categories" \
  -H 'content-type: application/json' \
  -H "authorization: Bearer $ADMIN_TOKEN" \
  -d '{"name":"Checkout Category","isActive":true}' | parse_json_field id)

PRODUCT_JSON=$(curl -sS -X POST "$API_URL/admin/products" \
  -H 'content-type: application/json' \
  -H "authorization: Bearer $ADMIN_TOKEN" \
  -d "{\"title\":\"Checkout Tee\",\"status\":\"ACTIVE\",\"priceCents\":2599,\"categoryIds\":[\"$CATEGORY_ID\"]}")
VARIANT_ID=$(echo "$PRODUCT_JSON" | node -e 'const fs=require("fs");const d=JSON.parse(fs.readFileSync(0,"utf8"));process.stdout.write(d.variants[0].id)')

echo "[3/11] Setup location + inventory"
LOCATION_ID=$(curl -sS -X POST "$API_URL/admin/locations" \
  -H 'content-type: application/json' \
  -H "authorization: Bearer $ADMIN_TOKEN" \
  -d '{"name":"Main Warehouse","code":"MAIN"}' | parse_json_field id)

curl -sS -X POST "$API_URL/admin/inventory/adjust" \
  -H 'content-type: application/json' \
  -H "authorization: Bearer $ADMIN_TOKEN" \
  -d "{\"variantId\":\"$VARIANT_ID\",\"locationId\":\"$LOCATION_ID\",\"delta\":10}" >/dev/null

echo "[4/11] Enable pickup shipping"
curl -sS -X PATCH "$API_URL/admin/settings/shipping-methods/PICKUP" \
  -H 'content-type: application/json' \
  -H "authorization: Bearer $ADMIN_TOKEN" \
  -d '{"enabled":true,"name":"Pickup","configJson":{"instructions":"Front desk"}}' >/dev/null

echo "[5/11] Register/Login customer"
CUSTOMER_REGISTER=$(curl -sS -X POST "$API_URL/store/auth/register" \
  -H 'content-type: application/json' \
  -d "{\"email\":\"$CUSTOMER_EMAIL\",\"password\":\"$CUSTOMER_PASSWORD\",\"name\":\"Smoke Customer\"}" || true)

CUSTOMER_LOGIN=$(curl -sS -X POST "$API_URL/store/auth/login" \
  -H 'content-type: application/json' \
  -d "{\"email\":\"$CUSTOMER_EMAIL\",\"password\":\"$CUSTOMER_PASSWORD\"}")
CUSTOMER_TOKEN=$(echo "$CUSTOMER_LOGIN" | parse_json_field accessToken)

echo "[6/11] Create cart item"
CART=$(curl -sS -X POST "$API_URL/store/cart/items" \
  -H 'content-type: application/json' \
  -H "authorization: Bearer $CUSTOMER_TOKEN" \
  -d "{\"variantId\":\"$VARIANT_ID\",\"quantity\":2}")
echo "$CART"

echo "[7/11] Checkout preview"
PREVIEW=$(curl -sS -X POST "$API_URL/store/checkout/preview" \
  -H 'content-type: application/json' \
  -H "authorization: Bearer $CUSTOMER_TOKEN" \
  -d '{"shippingMethodType":"PICKUP"}')
echo "$PREVIEW"

echo "[8/11] Create payment intent"
PI_JSON=$(curl -sS -X POST "$API_URL/store/checkout/create-payment-intent" \
  -H 'content-type: application/json' \
  -H "authorization: Bearer $CUSTOMER_TOKEN" \
  -d '{"shippingMethodType":"PICKUP"}')
echo "$PI_JSON"
PI_ID=$(echo "$PI_JSON" | parse_json_field paymentIntentId)

if [ -z "$STRIPE_SECRET_KEY" ]; then
  echo "STRIPE_SECRET_KEY not set; skipping payment confirmation and order confirmation."
  exit 0
fi

echo "[9/11] Confirm Stripe payment intent (test card)"
curl -sS -X POST "https://api.stripe.com/v1/payment_intents/$PI_ID/confirm" \
  -u "$STRIPE_SECRET_KEY": \
  -d payment_method=pm_card_visa >/dev/null

echo "[10/11] Confirm checkout"
ORDER=$(curl -sS -X POST "$API_URL/store/checkout/confirm" \
  -H 'content-type: application/json' \
  -H "authorization: Bearer $CUSTOMER_TOKEN" \
  -d "{\"paymentIntentId\":\"$PI_ID\",\"shippingMethodType\":\"PICKUP\"}")
echo "$ORDER"
ORDER_ID=$(echo "$ORDER" | parse_json_field id)

echo "[11/11] Admin list orders + partial refund"
curl -sS "$API_URL/admin/orders?page=1" -H "authorization: Bearer $ADMIN_TOKEN"
echo
curl -sS -X POST "$API_URL/admin/orders/$ORDER_ID/refunds" \
  -H 'content-type: application/json' \
  -H "authorization: Bearer $ADMIN_TOKEN" \
  -d '{"amountCents":500,"reason":"Smoke partial refund"}'
echo

echo "Smoke checkout/orders flow complete"
