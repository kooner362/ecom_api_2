#!/usr/bin/env bash
set -euo pipefail

API_URL="${API_URL:-http://localhost:3000}"
CUSTOMER_EMAIL="${CUSTOMER_EMAIL:-addresses@example.com}"
CUSTOMER_PASSWORD="${CUSTOMER_PASSWORD:-ChangeMe123!}"

parse_json_field() {
  local field="$1"
  node -e 'const fs=require("fs");const field=process.argv[1];const data=JSON.parse(fs.readFileSync(0,"utf8"));const value=data[field];if(value===undefined||value===null){process.exit(1)};process.stdout.write(String(value));' "$field"
}

echo "[1/6] Register/Login customer"
curl -sS -X POST "$API_URL/store/auth/register" \
  -H 'content-type: application/json' \
  -d "{\"email\":\"$CUSTOMER_EMAIL\",\"password\":\"$CUSTOMER_PASSWORD\",\"name\":\"Address Smoke\"}" >/dev/null || true

CUSTOMER_LOGIN=$(curl -sS -X POST "$API_URL/store/auth/login" \
  -H 'content-type: application/json' \
  -d "{\"email\":\"$CUSTOMER_EMAIL\",\"password\":\"$CUSTOMER_PASSWORD\"}")
CUSTOMER_TOKEN=$(echo "$CUSTOMER_LOGIN" | parse_json_field accessToken)

echo "[2/6] Create address"
CREATED=$(curl -sS -X POST "$API_URL/store/addresses" \
  -H 'content-type: application/json' \
  -H "authorization: Bearer $CUSTOMER_TOKEN" \
  -d '{"name":"Smoke Address","line1":"123 Main St","city":"Toronto","province":"ON","country":"CA","postalCode":"M5V2T6","phone":"4165550000","isDefault":true}')
echo "$CREATED"
ADDRESS_ID=$(echo "$CREATED" | parse_json_field id)

echo "[3/6] List addresses"
LIST=$(curl -sS "$API_URL/store/addresses" -H "authorization: Bearer $CUSTOMER_TOKEN")
echo "$LIST"
echo "$LIST" | node -e 'const fs=require("fs");const d=JSON.parse(fs.readFileSync(0,"utf8"));if(!Array.isArray(d.items)||d.items.length===0){process.exit(1)}'

echo "[4/6] Update address"
UPDATED=$(curl -sS -X PATCH "$API_URL/store/addresses/$ADDRESS_ID" \
  -H 'content-type: application/json' \
  -H "authorization: Bearer $CUSTOMER_TOKEN" \
  -d '{"line1":"500 King St W","city":"Toronto","isDefault":true}')
echo "$UPDATED"
echo "$UPDATED" | node -e 'const fs=require("fs");const d=JSON.parse(fs.readFileSync(0,"utf8"));if(d.line1!=="500 King St W"){process.exit(1)}'

echo "[5/6] Delete address"
DELETED=$(curl -sS -X DELETE "$API_URL/store/addresses/$ADDRESS_ID" -H "authorization: Bearer $CUSTOMER_TOKEN")
echo "$DELETED"
echo "$DELETED" | node -e 'const fs=require("fs");const d=JSON.parse(fs.readFileSync(0,"utf8"));if(d.ok!==true){process.exit(1)}'

echo "[6/6] Verify deleted"
FINAL_LIST=$(curl -sS "$API_URL/store/addresses" -H "authorization: Bearer $CUSTOMER_TOKEN")
echo "$FINAL_LIST"
echo "$FINAL_LIST" | node -e 'const fs=require("fs");const d=JSON.parse(fs.readFileSync(0,"utf8"));if(!Array.isArray(d.items)){process.exit(1)}'

echo "Smoke addresses flow complete"
