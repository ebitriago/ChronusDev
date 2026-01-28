#!/bin/bash

CRM_URL="http://localhost:3002"
CHRONUS_URL="http://localhost:3001"

echo "🔹 1. Creating Test Customer..."
# Create Customer
CUST_RES=$(curl -s -X POST "$CRM_URL/customers" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Ticket Test Corp",
    "email": "ticket@test.com",
    "phone": "555-9999",
    "plan": "PRO"
  }')

CUST_ID=$(echo $CUST_RES | grep -o '"id":"[^"]*' | cut -d'"' -f4)
echo "   Customer ID: $CUST_ID"

if [ -z "$CUST_ID" ]; then
  echo "❌ Failed to create customer"
  echo "Response: $CUST_RES"
  exit 1
fi

echo "   Waiting for Async Sync..."
sleep 2

# Verify Sync
CUST_GET=$(curl -s "$CRM_URL/customers/$CUST_ID")
CHRONUS_ID=$(echo $CUST_GET | grep -o '"chronusDevClientId":"[^"]*' | cut -d'"' -f4)
PROJECT_ID=$(echo $CUST_GET | grep -o '"chronusDevDefaultProjectId":"[^"]*' | cut -d'"' -f4)

if [ -n "$CHRONUS_ID" ]; then
    echo "✅ Customer Synced. ChronusID: $CHRONUS_ID"
else
    echo "❌ Customer Sync Failed. No ChronusID."
    exit 1
fi

if [ -n "$PROJECT_ID" ]; then
    echo "✅ Project Synced. ProjectID: $PROJECT_ID"
else
    echo "❌ Project Sync Failed. No ProjectID."
    # We can try to proceed if the ticket creation triggers sync, but let's warn
fi

echo "🔹 2. Creating Ticket (should trigger Task creation)..."
TICKET_RES=$(curl -s -X POST "$CRM_URL/tickets" \
  -H "Content-Type: application/json" \
  -d "{
    \"customerId\": \"$CUST_ID\",
    \"title\": \"Sync Test Ticket\",
    \"description\": \"Testing automatic task creation\",
    \"priority\": \"HIGH\"
  }")

TICKET_ID=$(echo $TICKET_RES | grep -o '"id":"[^"]*' | cut -d'"' -f4)
echo "   Ticket Created: $TICKET_ID"

echo "   Waiting for Async Task Creation..."
sleep 2

echo "🔹 3. Verifying Ticket Update..."
TICKET_GET=$(curl -s "$CRM_URL/tickets?customerId=$CUST_ID")
# We just grab the first one matching our ID roughly or just check the list
TASK_ID=$(echo $TICKET_GET | grep -o '"chronusDevTaskId":"[^"]*' | cut -d'"' -f4 | head -n 1)

if [ -n "$TASK_ID" ]; then
    echo "✅ Ticket Synced! Task ID: $TASK_ID"
else
    echo "❌ Ticket Sync Failed. No Task ID found in ticket."
    echo "Ticket Data: $TICKET_GET"
fi

echo "🔹 Done."
