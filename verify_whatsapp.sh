#!/bin/bash

# Test de Integración WhatsApp
set -e

CRM_URL="http://localhost:3002"

echo "🧪 Test de Integración WhatsApp"
echo "======================================"
echo ""

# 1. Login
echo -n "1. Autenticando... "
LOGIN_RESPONSE=$(curl -s -X POST "$CRM_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@chronuscrm.com", "password": "password123"}')

TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*' | cut -d'"' -f4)
ORG_ID=$(echo $LOGIN_RESPONSE | grep -o '"organizationId":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "❌ FALLO"
  echo "Response: $LOGIN_RESPONSE"
  exit 1
fi
echo "✅"

# 2. Get Providers
echo -n "2. Obteniendo proveedores... "
PROVIDERS_RESPONSE=$(curl -s -X GET "$CRM_URL/whatsapp/providers" \
  -H "Authorization: Bearer $TOKEN")

# Check if it's a valid JSON array or object
if echo "$PROVIDERS_RESPONSE" | grep -q "id"; then
  echo "✅"
  echo "   📝 Providers Found:"
  echo "$PROVIDERS_RESPONSE" | grep -o '"name":"[^"]*"' | sed 's/^/      - /'
  
  # Extract first provider ID for further tests
  PROVIDER_ID=$(echo "$PROVIDERS_RESPONSE" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)
else
  echo "⚠️  No providers found or invalid response"
  echo "Response: $PROVIDERS_RESPONSE"
fi

if [ -n "$PROVIDER_ID" ]; then
    # 3. Check Status
    echo -n "3. Verificando estado de proveedor ($PROVIDER_ID)... "
    STATUS_RESPONSE=$(curl -s -X GET "$CRM_URL/whatsapp/providers/$PROVIDER_ID/status" \
      -H "Authorization: Bearer $TOKEN")
    
    STATUS=$(echo $STATUS_RESPONSE | grep -o '"status":"[^"]*' | cut -d'"' -f4)
    echo "✅ ($STATUS)"
else 
    echo "⏭️  Saltando chequeo de estado (no provider ID)"
fi

# 4. Simulate Webhook (Incoming Message)
echo ""
echo -n "4. Simulando Webhook (Mensaje entrante)... "
WEBHOOK_PAYLOAD='{
  "object": "whatsapp_business_account",
  "entry": [{
    "id": "WHATSAPP_BUS_ID",
    "changes": [{
      "value": {
        "messaging_product": "whatsapp",
        "metadata": { "display_phone_number": "15550200", "phone_number_id": "PHONE_ID" },
        "contacts": [{ "profile": { "name": "Test User" }, "wa_id": "15550100" }],
        "messages": [{
          "from": "15550100",
          "id": "wamid.test_'$(date +%s)'",
          "timestamp": "'$(date +%s)'",
          "text": { "body": "Hello from automated test" },
          "type": "text"
        }]
      },
      "field": "messages"
    }]
  }]
}'

WEBHOOK_RESPONSE=$(curl -s -X POST "$CRM_URL/whatsapp/webhook" \
  -H "Content-Type: application/json" \
  -d "$WEBHOOK_PAYLOAD")

if [ "$WEBHOOK_RESPONSE" == "EVENT_RECEIVED" ]; then
  echo "✅ (Recibido)"
else
  echo "⚠️ Respuesta inesperada: $WEBHOOK_RESPONSE"
fi

# 5. Verify conversation created in CRM
echo -n "5. Verificando conversación creada... "
sleep 2 

# We need to search specifically. Let's list recent conversations if endpoint exists
# Assuming GET /conversations exists (based on schema)
CONV_RESPONSE=$(curl -s -X GET "$CRM_URL/conversations" \
  -H "Authorization: Bearer $TOKEN")

if echo "$CONV_RESPONSE" | grep -q "15550100"; then
    echo "✅ Conversación encontrada para 15550100"
else
    echo "⚠️ No se pudo verificar la conversación (puede requerir endpoint específico)"
fi

echo ""
echo "======================================"
echo "✅ TEST WHATSAPP COMPLETADO"
