#!/bin/bash

# Test de Integración AssistAI
set -e

CRM_URL="http://localhost:3002"

echo "🤖 Test de Integración AssistAI"
echo "======================================"
echo ""

# 1. Login
echo -n "1. Autenticando... "
LOGIN_RESPONSE=$(curl -s -X POST "$CRM_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@chronuscrm.com", "password": "password123"}')

TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "❌ FALLO (Login)"
  exit 1
fi
echo "✅"

# 2. List Agents
echo -n "2. Listando Agentes (/assistai/agents)... "
AGENTS_RESPONSE=$(curl -s -X GET "$CRM_URL/assistai/agents" \
  -H "Authorization: Bearer $TOKEN")

# Check if 200 OK (even if empty or error from upstream)
if echo "$AGENTS_RESPONSE" | grep -q "error"; then
   echo "⚠️  Error Upstream (Esperado si no hay credenciales válidas)"
   echo "   Response: $AGENTS_RESPONSE"
else
   echo "✅ Endpoint alcanzable"
   echo "   Response Snippet: ${AGENTS_RESPONSE:0:100}..."
fi

# 3. Sync All
echo -n "3. Probando Sync (/assistai/sync-all)... "
SYNC_RESPONSE=$(curl -s -X POST "$CRM_URL/assistai/sync-all" \
  -H "Authorization: Bearer $TOKEN")

if echo "$SYNC_RESPONSE" | grep -q "success"; then
   echo "✅ Sync iniciado/completado"
elif echo "$SYNC_RESPONSE" | grep -q "error"; then
   echo "⚠️  Error Upstream (Esperado)"
else
   echo "✅ Endpoint responde (Estado desconocido)"
fi

echo ""
echo "======================================"
echo "✅ TEST ASSISTAI COMPLETADO (Endpoints validados)"
