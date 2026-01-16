#!/bin/bash

CRM_URL="http://localhost:3002"
CHRONUS_URL="http://localhost:3001"

echo "🔹 Testing CRM Automation..."

# 1. Create Customer -> Logic should auto-create Project
echo "1️⃣ Creating Customer 'Automation Corp'..."
CUST_RES=$(curl -s -X POST "$CRM_URL/customers" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Automation Corp",
    "email": "bot@autocorp.com",
    "phone": "999-0000",
    "plan": "ENTERPRISE"
  }')

CUST_ID=$(echo $CUST_RES | grep -o '"id":"[^"]*' | cut -d'"' -f4)
echo "   Customer Created: $CUST_ID"

sleep 3 # Wait for async automation

# Verify if Project ID is stored in Customer
echo "2️⃣ verifying Customer data for Project ID..."
GET_CUST=$(curl -s "$CRM_URL/customers/$CUST_ID")
PROJ_ID=$(echo $GET_CUST | grep -o '"chronusDevDefaultProjectId":"[^"]*' | cut -d'"' -f4)

if [ -n "$PROJ_ID" ]; then
    echo "   ✅ Success! Auto-created Project ID: $PROJ_ID"
else
    echo "   ❌ Failed. Project ID not found in Customer. Check backend logs."
    exit 1
fi

# 2. Create Ticket -> Logic should auto-create Task
echo "3️⃣ Creating Ticket for this customer..."
TICKET_RES=$(curl -s -X POST "$CRM_URL/tickets" \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": "'"$CUST_ID"'",
    "title": "Auto Task Test",
    "description": "This ticket should become a task",
    "priority": "HIGH"
  }')

TICKET_ID=$(echo $TICKET_RES | grep -o '"id":"tkt-[^"]*' | cut -d'"' -f4)
echo "   Ticket Created: $TICKET_ID"

sleep 3 # Wait for async task creation

echo "4️⃣ Verifying Ticket for Task ID..."
GET_TICKET=$(curl -s "$CRM_URL/tickets" | grep "$TICKET_ID")
# This is a bit rough, but let's check if the ticket has the taskId field.
# Or better, fetch the task from ChronusDev

echo "5️⃣ Checking Task in ChronusDev..."
# Use correct endpoint and Auth token
TASKS_RES=$(curl -s -H "Authorization: Bearer token-admin-123" "$CHRONUS_URL/tasks?projectId=$PROJ_ID")

if [[ $TASKS_RES == *"[CRM] Auto Task Test"* ]]; then
     echo "   ✅ Success! Task '[CRM] Auto Task Test' found in Project $PROJ_ID"
else
     echo "   ❌ Failed. Task not found. Response: $TASKS_RES"
fi

echo "🔹 Automation Test Complete."
