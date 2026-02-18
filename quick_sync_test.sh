#!/bin/bash

echo "🧪 Manual Quick Test - CRM Sync"
echo "================================"

CRM_URL="http://localhost:3002"

# Step 1: Login
echo -n "1. Login... "
TOKEN=$(curl -s -X POST "$CRM_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@chronuscrm.com", "password": "password123"}' \
  | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "❌ FAILED"
  exit 1
fi
echo "✅ OK"

# Step 2: Create Customer
echo -n "2. Create Customer... "
CUSTOMER=$(curl -s -X POST "$CRM_URL/customers" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{
    \"name\": \"Test Sync $(date +%s)\",
    \"email\": \"test-$(date +%s)@example.com\",
    \"phone\": \"555-0100\",
    \"plan\": \"PRO\"
  }")
CUST_ID=$(echo $CUSTOMER | grep -o '"id":"[^"]*' | cut -d'"' -f4)

if [ -z "$CUST_ID" ]; then
  echo "❌ FAILED"
  echo "Response: $CUSTOMER"
  exit 1
fi
echo "✅ OK (ID: $CUST_ID)"

# Step 3: Wait for async sync
echo -n "3. Waiting for async sync... "
sleep 4
echo "✅ OK"

# Step 4: Verify sync
echo -n "4. Verify ChronusDev sync... "
CUSTOMER_DATA=$(curl -s "$CRM_URL/customers/$CUST_ID" \
  -H "Authorization: Bearer $TOKEN")
  
CHRONUS_CLIENT_ID=$(echo $CUSTOMER_DATA | grep -o '"chronusDevClientId":"[^"]*' | cut -d'"' -f4)
CHRONUS_PROJECT_ID=$(echo $CUSTOMER_DATA | grep -o '"chronusDevDefaultProjectId":"[^"]*' | cut -d'"' -f4)

echo ""
echo "   ChronusDev Client ID: ${CHRONUS_CLIENT_ID:-null}"
echo "   ChronusDev Project ID: ${CHRONUS_PROJECT_ID:-null}"

if [ -n "$CHRONUS_CLIENT_ID" ] && [ "$CHRONUS_CLIENT_ID" != "null" ]; then
  echo "   ✅ SYNC SUCCESSFUL!"
else
  echo "   ❌ SYNC FAILED - IDs are null"
  exit 1
fi

echo ""
echo "================================"
echo "✅ All tests passed!"
