#!/bin/bash

# Test de Sincronización Automática CRM -> ChronusDev
set -e

CRM_URL="http://localhost:3002"
CHRONUS_URL="http://localhost:3001" 

echo "🧪 Test de Sincronización Automática"
echo "======================================"
echo ""

# 1. Login
echo -n "1. Autenticando... "
LOGIN_RESPONSE=$(curl -s -X POST "$CRM_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@chronuscrm.com", "password": "password123"}')

TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "❌ FALLO"
  echo "Response: $LOGIN_RESPONSE"
  exit 1
fi
echo "✅"

# 2. Crear Customer
echo -n "2. Creando customer... "
TIMESTAMP=$(date +%s)
CUSTOMER_RESPONSE=$(curl -s -X POST "$CRM_URL/customers" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{
    \"name\": \"AutoTest Company $TIMESTAMP\",
    \"email\": \"test-$TIMESTAMP@example.com\",
    \"phone\": \"+1-555-0100\",
    \"plan\": \"PRO\"
  }")

CUSTOMER_ID=$(echo $CUSTOMER_RESPONSE | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)

if [ -z "$CUSTOMER_ID" ]; then
  echo "❌ FALLO"
  echo "Response: $CUSTOMER_RESPONSE"
  exit 1
fi
echo "✅ (ID: $CUSTOMER_ID)"

# 3. Esperar sincronización asíncrona
echo -n "3. Esperando sincronización automática (5 seg)... "
sleep 5
echo "✅"

# 4. Verificar sincronización
echo -n "4. Verificando sincronización... "
CUSTOMER_CHECK=$(curl -s "$CRM_URL/customers/$CUSTOMER_ID" \
  -H "Authorization: Bearer $TOKEN")

echo ""
echo "   📋 Customer Response:"
echo "$CUSTOMER_CHECK" | grep -E '"chronusDevClientId"|"chronusDevDefaultProjectId"' | sed 's/^/      /'

CHRONUS_CLIENT_ID=$(echo $CUSTOMER_CHECK | grep -o '"chronusDevClientId":"[^"]*' | cut -d'"' -f4)
CHRONUS_PROJECT_ID=$(echo $CUSTOMER_CHECK | grep -o '"chronusDevDefaultProjectId":"[^"]*' | cut -d'"' -f4)

echo ""
if [ -n "$CHRONUS_CLIENT_ID" ] && [ "$CHRONUS_CLIENT_ID" != "null" ]; then
  echo "   ✅ chronusDevClientId: $CHRONUS_CLIENT_ID"
else
  echo "   ❌ chronusDevClientId: null o vacío"
  echo ""
  echo "======================================"
  echo "❌ SINCRONIZACIÓN FALLÓ"
  exit 1
fi

if [ -n "$CHRONUS_PROJECT_ID" ] && [ "$CHRONUS_PROJECT_ID" != "null" ]; then
  echo "   ✅ chronusDevDefaultProjectId: $CHRONUS_PROJECT_ID"
else
  echo "   ⚠️  chronusDevDefaultProjectId: null o vacío"
fi

# 5. Verificar en ChronusDev
echo ""
echo -n "5. Verificando client en ChronusDev... "
CLIENT_CHECK=$(curl -s "$CHRONUS_URL/clients/$CHRONUS_CLIENT_ID" \
  -H "Authorization: Bearer token-admin-123")

CLIENT_NAME=$(echo $CLIENT_CHECK | grep -o '"name":"[^"]*' | cut -d'"' -f4)

if [ -n "$CLIENT_NAME" ]; then
  echo "✅"
  echo "   📝 Client Name: $CLIENT_NAME"
else
  echo "❌ No encontrado"
  exit 1
fi

# 6. Crear Ticket
echo ""
echo -n "6. Creando ticket..."
TICKET_RESPONSE=$(curl -s -X POST "$CRM_URL/tickets" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{
    \"customerId\": \"$CUSTOMER_ID\",
    \"title\": \"Test Ticket $TIMESTAMP\",
    \"description\": \"Este es un ticket de prueba automático\",
    \"priority\": \"HIGH\"
  }")

TICKET_ID=$(echo $TICKET_RESPONSE | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)

if [ -z "$TICKET_ID" ]; then
  echo " ❌ FALLO"
  echo "Response: $TICKET_RESPONSE"
  exit 1
fi
echo " ✅ (ID: $TICKET_ID)"

# 7. Esperar sincronización de ticket
echo -n "7. Esperando sincronización de ticket (5 seg)... "
sleep 5
echo "✅"

# 8. Verificar task en ChronusDev
echo -n "8. Verificando task en ticket... "
TICKET_CHECK=$(curl -s "$CRM_URL/tickets?customerId=$CUSTOMER_ID" \
  -H "Authorization: Bearer $TOKEN")

TASK_ID=$(echo $TICKET_CHECK | grep -o '"taskId":"[^"]*' | head -1 | cut -d'"' -f4)

if [ -n "$TASK_ID" ] && [ "$TASK_ID" != "null" ]; then
  echo "✅"
  echo "   📝 Task ID: $TASK_ID"
else
  echo "⚠️  taskId no encontrado o null"
fi

echo ""
echo "======================================"
echo "✅ TEST COMPLETADO EXITOSAMENTE!"
echo ""
echo "Resumen:"
echo "  • Customer sincronizado: ✅"
echo "  • Client creado en ChronusDev: ✅"
echo "  • Proyecto default creado: $([ -n "$CHRONUS_PROJECT_ID" ] && echo "✅" || echo "⚠️")"
echo "  • Ticket sincronizado: $([ -n "$TASK_ID" ] && echo "✅" || echo "⚠️")"
echo ""
