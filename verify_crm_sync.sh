#!/bin/bash

CRM_URL="http://localhost:3002"
CHRONUS_URL="http://localhost:3001"

# Get Auth Token
echo "🔐 Getting auth token..."
AUTH_RES=$(curl -s -X POST "$CRM_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@chronuscrm.com", "password": "password123"}')

TOKEN=$(echo $AUTH_RES | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "❌ Failed to get auth token"
  echo "Response: $AUTH_RES"
  exit 1
fi

echo "✅ Auth token obtained"

echo "🔹 Testing CRM Customer Creation with Sync..."
# Create Customer
CREATE_RES=$(curl -s -X POST "$CRM_URL/customers" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Test Company Inc",
    "email": "contact@testcompany.com",
    "phone": "555-0199",
    "plan": "PRO"
  }')

echo "Create Response: $CREATE_RES"

CUST_ID=$(echo $CREATE_RES | grep -o '"id":"[^"]*' | cut -d'"' -f4)
CHRONUS_ID=$(echo $CREATE_RES | grep -o '"chronusDevClientId":"[^"]*' | cut -d'"' -f4)

if [ -z "$CUST_ID" ]; then
  echo "❌ Failed to create customer"
  exit 1
fi

echo "✅ Customer Created: $CUST_ID"
# Note: chronusDevClientId might not be in the immediate response if it's async, 
# but we stored it in the object in memory. Let's fetch it to be sure.

sleep 2 # Wait for async sync

echo "🔹 Fetching Customer to verify Sync ID..."
GET_RES=$(curl -s "$CRM_URL/customers/$CUST_ID" -H "Authorization: Bearer $TOKEN")
echo "Get Response: $GET_RES"

CHRONUS_ID_FETCHED=$(echo $GET_RES | grep -o '"chronusDevClientId":"[^"]*' | cut -d'"' -f4)

if [ -n "$CHRONUS_ID_FETCHED" ]; then
    echo "✅ Sync Successful! ChronusDev Client ID: $CHRONUS_ID_FETCHED"
else
    echo "⚠️ Sync ID missing. It might be an async timing issue or sync failed."
fi

echo "🔹 Testing Customer Update with Sync..."
UPDATE_RES=$(curl -s -X PUT "$CRM_URL/customers/$CUST_ID" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "notes": "Updated notes for sync test"
  }')
echo "Update Response: $UPDATE_RES"

sleep 1

echo "🔹 Testing Manual Sync..."
SYNC_RES=$(curl -s -X POST "$CRM_URL/customers/$CUST_ID/sync" -H "Authorization: Bearer $TOKEN")
echo "Sync Response: $SYNC_RES"

echo "🔹 Done."
