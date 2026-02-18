# 📔 Manual de Usuario y Desarrollador - ChronusDev & CRM

Bienvenido a la documentación oficial de **ChronusDev**, una plataforma integral SaaS que combina la gestión de relaciones con clientes (CRM) con una potente herramienta de gestión de proyectos y soporte técnico.

---

## 📑 Tabla de Contenidos

1. [Visión General](#visión-general)
2. [Guía de Instalación](#guía-de-instalación)
3. [Mapa de Funcionalidades](#mapa-de-funcionalidades)
4. [Documentación de la API](#documentación-de-la-api)
5. [Guía para Desarrolladores](#guía-para-desarrolladores)

---

## 🌟 Visión General

ChronusDev está diseñado para empresas que necesitan un control total sobre su ciclo de vida de cliente. Desde que un cliente es un prospecto (Lead) hasta que se convierte en un cliente activo con proyectos y necesidades de soporte técnico.

### Core Tecnológico
*   **Backend**: Node.js, Express, Prisma (PostgreSQL).
*   **Frontend**: Next.js, React, Tailwind CSS.
*   **IA**: Integración con Google Gemini y AssistAI.
*   **Comunicación**: Webhooks omnicanal (WhatsApp) e Inbox unificado.

---

## 🚀 Guía de Instalación

### Requisitos Previos
*   Node.js v18+
*   Docker (opcional, para base de datos)
*   PostgreSQL

### Pasos para Local
1.  **Clonar el repositorio**:
    ```bash
    git clone [url-del-repo]
    cd ChronusDev-1
    ```

2.  **Instalar dependencias**:
    ```bash
    npm install
    ```

3.  **Configurar variables de entorno**:
    Crea un archivo `.env` en `apps/backend` basado en `.env.example`.
    ```env
    CHRONUSDEV_DATABASE_URL="postgresql://user:pass@localhost:5432/db"
    JWT_SECRET="tu-secreto"
    ```

4.  **Ejecutar migraciones**:
    ```bash
    cd apps/backend
    npx prisma migrate dev
    ```

5.  **Iniciar en modo desarrollo**:
    ```bash
    # En la raíz
    npm run dev
    ```

---

## 🗺️ Mapa de Funcionalidades

### 1. Panel de Control (Dashboard)
Visualización de métricas clave, estados de proyectos y actividad reciente. Permite una navegación rápida a las tareas más urgentes.

### 2. Gestión de Clientes (CRM)
*   **Clientes 360°**: Historial completo de cada cliente.
*   **Sincronización**: Mantén tus datos actualizados entre ChronusDev y plataformas externas.

### 3. Soporte y Tickets
*   **Vista de Lista y Kanban**: Dos formas de visualizar el trabajo.
*   **Escalamiento a Dev**: Convierte un ticket de soporte en una tarea técnica para el equipo de desarrollo con un solo clic.

### 4. Finanzas y ERP
*   **Contabilidad Básica**: Registro de ingresos y gastos.
*   **Facturación**: Gestión de estados de pago.
*   **Reportes**: Generación automática de reportes en PDF y CSV.

### 5. Inbox Inteligente
La bandeja de entrada unificada permite responder a mensajes de múltiples canales. La integración con **AssistAI** permite generar respuestas automáticas basadas en el contexto del cliente.

---

## 🔗 Documentación de la API

Hemos implementado una documentación interactiva utilizando **Scalar**. Puedes acceder a ella mientras el servidor está corriendo en:

👉 [**http://localhost:3001/reference**](http://localhost:3001/reference)

### ¿Cómo usarla?
1.  Inicia el backend (`npm run dev`).
2.  Navega a `/reference`.
3.  Usa el botón "Authorize" para añadir tu token JWT (obtenido tras login).
4.  Prueba los endpoints directamente desde el navegador.

---

## 🛠️ Guía para Desarrolladores

### Estructura de Carpetas
*   `/apps/backend`: Lógica de servidor, API y base de datos.
*   `/apps/crm-frontend`: Aplicación principal del CRM (Next.js).
*   `/apps/backend/src/routes`: Define todos los endpoints de la API.
*   `/apps/backend/prisma/schema.prisma`: Definición del modelo de datos.

### Extender la API
Para añadir una nueva funcionalidad:
1.  Crea un nuevo modelo en `schema.prisma` (si es necesario).
2.  Crea una nueva ruta en `src/routes/[mi-funcionalidad].ts`.
3.  Añade decoradores JSDoc (`@openapi`) para que aparezca automáticamente en la documentación de Scalar.
4.  Registra la ruta en `src/index.ts`.

### Contribución
Sigue los estándares de código (ESLint) y asegúrate de documentar cualquier nuevo endpoint para que otros desarrolladores puedan consumirlo fácilmente.
