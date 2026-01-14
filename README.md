# ChronusDev (MVP)

MVP de tracking de proyectos, tiempo y costos para equipos tech. Flujo principal: Admin crea proyecto con presupuesto y tarifas; devs hacen Start/Stop en tareas; el sistema descuenta presupuesto y genera reportes para cliente (PDF placeholder) y nómina (CSV).

## Características del MVP

### Timer Flotante
- Widget de cronómetro siempre visible en todas las pantallas
- Permite iniciar/pausar tareas rápidamente
- Cambio de tarea sin entrar a menús profundos
- Al detener, pregunta inmediatamente si se desea agregar una nota descriptiva

### Dashboard Admin
- Gráficos de barras comparando "Presupuesto Total" vs "Consumo Actual"
- Semáforo de presupuesto (Verde: <75%, Amarillo: 75-90%, Rojo: >90%)
- Descarga de PDF para cliente y CSV para nómina

### Vista Kanban
- Tarjetas de tarea con indicador de tiempo acumulado
- Columnas: Backlog, En Progreso, Completado
- Creación rápida de nuevas tareas

### Reporte Printer-Friendly
- Vista optimizada para impresión/PDF
- Diseño limpio y profesional

## Estructura
- `apps/backend`: API Express + TypeScript con datos en memoria (demo).
- `apps/frontend`: Frontend Next.js con React, TypeScript y Tailwind CSS.

## Requisitos
- Node 18+ (recomendado 20).
- npm o yarn

## Setup rápido

### Instalar dependencias
```bash
cd chronusdev
npm install
cd apps/backend && npm install
cd ../frontend && npm install
cd ../.. && npm install  # Instalar dependencias de la raíz (concurrently, open)
```

### Opción 1: Ejecutar todo junto (recomendado)
```bash
npm run dev
```
Esto iniciará backend y frontend, y abrirá automáticamente el navegador en `http://localhost:3000`

### Opción 2: Ejecutar por separado

**Terminal 1 - Backend:**
```bash
npm run dev:backend
```
El backend estará disponible en `http://localhost:3001`

**Terminal 2 - Frontend:**
```bash
npm run dev:frontend
```
El frontend estará disponible en `http://localhost:3000`

Luego abre manualmente: `http://localhost:3000`

## Uso

1. **Seleccionar usuario**: En el frontend, usa el selector en la barra superior para cambiar entre Admin y Dev (Juan).

2. **Admin - Crear proyecto**:
   - Usa el dashboard para ver proyectos y presupuestos
   - Los proyectos se crean vía API (ver endpoints abajo)

3. **Dev - Trabajar en tareas**:
   - Ve las tareas en la vista Kanban
   - Usa el Timer flotante (esquina inferior derecha) para iniciar/detener trabajo
   - Al detener, agrega una nota descriptiva

4. **Admin - Ver reportes**:
   - Dashboard muestra consumo en tiempo real
   - Botones para descargar PDF (cliente) y CSV (nómina)

## API (demo, datos en memoria)

### Proyectos
- `GET /projects` - Lista proyectos
- `POST /projects` - Crea proyecto (solo admin)
- `POST /projects/:id/assignments` - Asigna dev + tarifas (solo admin)
- `GET /projects/:id/summary` - Resumen presupuesto

### Tareas
- `GET /tasks?projectId=xxx` - Lista tareas (opcionalmente filtradas por proyecto)
- `POST /tasks` - Crea tarea

### Timelogs
- `GET /timelogs/current` - Obtiene timer activo del usuario
- `POST /timelogs/start` - Inicia registro de tiempo
- `POST /timelogs/stop` - Detiene registro y calcula costes
- `PUT /timelogs/:id/note` - Agrega nota a un timelog

### Reportes
- `GET /reports/:projectId/monthly.pdf?month=YYYY-MM` - Placeholder PDF (JSON)
- `GET /reports/:projectId/payroll.csv?month=YYYY-MM` - CSV para nómina

**Autenticación**: Se simula con header `x-user-id` (ej: `u-admin`, `u-juan`)

## Datos de ejemplo (seed)

El backend incluye datos de ejemplo:
- Proyecto: "E-commerce Cliente X" con presupuesto de $5,000 USD
- Usuario: Juan (Dev) con tarifa interna $20/hr y tarifa cliente $50/hr
- Tarea: "Crear Home" en estado Backlog

Ver estado inicial: `GET http://localhost:3001/seed`

## Próximos pasos
- Persistencia real (Postgres/Prisma)
- Auth real (JWT/OAuth)
- Generación real de PDFs
- Integración GitHub/Jira
- Notificaciones y alertas de presupuesto
