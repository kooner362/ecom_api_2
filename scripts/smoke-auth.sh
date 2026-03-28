#!/usr/bin/env bash
set -euo pipefail

API_URL="${API_URL:-http://localhost:3000}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@example.com}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-ChangeMe123!}"
CUSTOMER_EMAIL="${CUSTOMER_EMAIL:-customer.$(date +%s)@example.com}"
CUSTOMER_PASSWORD="${CUSTOMER_PASSWORD:-Password123!}"

parse_token() {
  node -e 'const fs=require("fs");const data=JSON.parse(fs.readFileSync(0,"utf8"));if(!data.accessToken){process.exit(1)};process.stdout.write(data.accessToken);'
}

echo "[1/7] Customer register"
REGISTER_RES=$(curl -sS -X POST "$API_URL/store/auth/register" \
  -H 'content-type: application/json' \
  -d "{\"email\":\"$CUSTOMER_EMAIL\",\"password\":\"$CUSTOMER_PASSWORD\",\"name\":\"Smoke Test\"}")
CUSTOMER_TOKEN=$(echo "$REGISTER_RES" | parse_token)


echo "[2/7] Customer me"
curl -sS "$API_URL/store/me" \
  -H "authorization: Bearer $CUSTOMER_TOKEN"

echo
echo "[3/7] Customer logout"
curl -sS -X POST "$API_URL/store/auth/logout" \
  -H "authorization: Bearer $CUSTOMER_TOKEN"

echo
echo "[4/7] Customer login"
CUSTOMER_LOGIN=$(curl -sS -X POST "$API_URL/store/auth/login" \
  -H 'content-type: application/json' \
  -d "{\"email\":\"$CUSTOMER_EMAIL\",\"password\":\"$CUSTOMER_PASSWORD\"}")
CUSTOMER_TOKEN_2=$(echo "$CUSTOMER_LOGIN" | parse_token)

echo "[5/7] Customer me (new token)"
curl -sS "$API_URL/store/me" \
  -H "authorization: Bearer $CUSTOMER_TOKEN_2"

echo
echo "[6/7] Admin login"
ADMIN_LOGIN=$(curl -sS -X POST "$API_URL/admin/auth/login" \
  -H 'content-type: application/json' \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")
ADMIN_TOKEN=$(echo "$ADMIN_LOGIN" | parse_token)

echo "[7/7] Admin me"
curl -sS "$API_URL/admin/me" \
  -H "authorization: Bearer $ADMIN_TOKEN"

echo
echo "Smoke auth flow complete"
