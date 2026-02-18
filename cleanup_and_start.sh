#!/bin/bash

echo "🧹 Limpiando procesos anteriores..."
lsof -ti:3001 | xargs kill -9 2>/dev/null || true
lsof -ti:3002 | xargs kill -9 2>/dev/null || true
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
pkill -f "npm run dev" 2>/dev/null || true
sleep 2

echo "✅ Puertos limpiados"
echo ""
echo "🚀 Para levantar los servicios, ejecuta en terminales separadas:"
echo ""
echo "Terminal 1 - ChronusDev Backend:"
echo "  cd apps/backend && npm run dev"
echo ""
echo "Terminal 2 - CRM Backend:"
echo "  cd apps/crm && npm run dev"
echo ""
echo "Terminal 3 - CRM Frontend:"
echo "  cd apps/crm-frontend && npm run dev"
echo ""
echo "Terminal 4 - ChronusDev Frontend (opcional):"
echo "  cd apps/frontend && npm run dev"
echo ""
