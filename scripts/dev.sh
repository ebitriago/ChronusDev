#!/bin/bash

# Script para ejecutar backend y frontend y abrir el navegador

# Colores para output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Iniciando ChronusDev...${NC}"

# Verificar que estamos en el directorio correcto
if [ ! -d "apps/backend" ] || [ ! -d "apps/frontend" ]; then
    echo -e "${YELLOW}⚠️  Por favor ejecuta este script desde la raíz del proyecto${NC}"
    exit 1
fi

# Función para abrir navegador después de esperar
open_browser() {
    sleep 5
    echo -e "${GREEN}🌐 Abriendo navegador en http://localhost:3000${NC}"
    if command -v open &> /dev/null; then
        # macOS
        open http://localhost:3000
    elif command -v xdg-open &> /dev/null; then
        # Linux
        xdg-open http://localhost:3000
    elif command -v start &> /dev/null; then
        # Windows
        start http://localhost:3000
    fi
}

# Iniciar backend en background
echo -e "${BLUE}📦 Iniciando backend...${NC}"
cd apps/backend
npm run dev > /tmp/chronusdev-backend.log 2>&1 &
BACKEND_PID=$!
cd ../..

# Iniciar frontend en background
echo -e "${BLUE}🎨 Iniciando frontend...${NC}"
cd apps/frontend
npm run dev > /tmp/chronusdev-frontend.log 2>&1 &
FRONTEND_PID=$!
cd ../..

# Abrir navegador después de un delay
open_browser &

echo -e "${GREEN}✅ Servidores iniciados!${NC}"
echo -e "${GREEN}   Backend:  http://localhost:3001 (PID: $BACKEND_PID)${NC}"
echo -e "${GREEN}   Frontend: http://localhost:3000 (PID: $FRONTEND_PID)${NC}"
echo -e "${YELLOW}📝 Logs del backend: tail -f /tmp/chronusdev-backend.log${NC}"
echo -e "${YELLOW}📝 Logs del frontend: tail -f /tmp/chronusdev-frontend.log${NC}"
echo -e "${YELLOW}🛑 Para detener: kill $BACKEND_PID $FRONTEND_PID${NC}"

# Esperar a que el usuario presione Ctrl+C
trap "echo -e '\n${YELLOW}🛑 Deteniendo servidores...${NC}'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM

# Mantener el script corriendo
wait
