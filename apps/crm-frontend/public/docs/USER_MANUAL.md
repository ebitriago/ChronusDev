# ChronusCRM - Manual de Usuario
> Guía completa para aprovechar al máximo tu plataforma de gestión de clientes

---

## 📋 Tabla de Contenidos

1. [Introducción](#introducción)
2. [Dashboard](#dashboard)
3. [Clientes](#clientes)
4. [Inbox Unificado](#inbox-unificado)
5. [Tickets de Soporte](#tickets-de-soporte)
6. [Leads y Embudo de Ventas](#leads-y-embudo-de-ventas)
7. [Facturación](#facturación)
8. [AssistAI - Agentes de IA](#assistai---agentes-de-ia)
9. [Developers](#developers)
10. [Integraciones](#integraciones)

---

## Introducción

**ChronusCRM** es una plataforma completa de gestión de relaciones con clientes diseñada para empresas modernas. Integra comunicación multicanal (WhatsApp, Instagram, Email), gestión de tickets, facturación y asistentes de IA para automatizar la atención al cliente.

### Acceso al Sistema

- **URL del CRM**: `http://localhost:3003` (desarrollo) o tu dominio configurado
- **API Backend**: `http://localhost:3002`
- **Documentación API**: `http://localhost:3002/api/docs`

---

## Dashboard

![Dashboard](./dashboard.png)

El Dashboard es tu centro de control principal. Aquí encontrarás:

| Sección | Descripción |
|---------|-------------|
| **Resumen de Ingresos** | Total de ingresos mensuales con gráficos de tendencia |
| **Clientes Activos** | Contador de clientes activos y su distribución por plan |
| **Tickets Abiertos** | Tickets pendientes organizados por prioridad |
| **Actividad Reciente** | Timeline de las últimas acciones en el sistema |

### Métricas Clave
- **MRR** (Monthly Recurring Revenue): Ingresos recurrentes mensuales
- **Churn Rate**: Porcentaje de clientes que cancelan
- **Ticket Resolution Time**: Tiempo promedio de resolución

---

## Clientes

### Vista de Clientes

La sección de **Clientes** contiene todos tus contactos comerciales organizados en fichas.

### Información de Cliente

Cada cliente incluye:
- **Datos de Contacto**: Nombre, email, teléfono, empresa
- **Plan**: FREE, STARTER, PRO, ENTERPRISE
- **Estado**: ACTIVE, INACTIVE, TRIAL, CHURNED
- **Ingresos Mensuales**: Valor del cliente
- **Tags**: Etiquetas personalizadas
- **Notas**: Comentarios internos

### Acciones Disponibles

| Acción | Descripción |
|--------|-------------|
| **Ver Detalle** | Abre la ficha completa del cliente |
| **Editar** | Modifica los datos del cliente |
| **Crear Ticket** | Abre un nuevo ticket de soporte |
| **Ver Facturas** | Lista las facturas del cliente |
| **Vista 360°** | Muestra todas las conversaciones e interacciones |

### Crear Nuevo Cliente

1. Clic en **"+ Nuevo Cliente"**
2. Completa el formulario con los datos
3. Guarda los cambios

### Editar Cliente

1. Pasa el mouse sobre la tarjeta del cliente
2. Haz clic en el ícono ✏️
3. Modifica los campos deseados
4. Guarda los cambios

### Eliminar Cliente

1. Pasa el mouse sobre la tarjeta del cliente
2. Haz clic en el ícono 🗑️
3. Confirma la eliminación

> ⚠️ **Advertencia**: Eliminar un cliente también elimina sus tickets asociados.

---

## Vista 360° del Cliente

La **Vista 360°** te permite ver toda la información de un cliente en un solo lugar.

### Cómo Acceder
1. Desde el **Inbox**, selecciona una conversación con un cliente vinculado
2. Haz clic en **"Ver Vista 360° →"** en el panel derecho

### Funciones Disponibles

| Tab | Contenido |
|-----|--------|
| **Información** | Datos del cliente, canales de contacto vinculados |
| **Tickets** | Lista de tickets del cliente, crear nuevos |
| **Notas** | Notas internas sobre el cliente |
| **Facturas** | Historial de facturación |

### Acciones Rápidas
- **💬 Abrir Chat**: Ir directamente a la conversación del cliente
- **🎫 Crear Ticket**: Abrir un ticket de soporte
- **📋 Crear Tarea ChronusDev**: Enviar tarea al sistema de desarrollo

### Vincular Canales Adicionales
Si un cliente te contacta por un nuevo canal (ej: primero por WhatsApp, luego por Instagram):
1. Desde la conversación nueva, haz clic en **"🔗 Vincular a Cliente"**
2. Busca el cliente existente
3. El nuevo canal quedará vinculado a ese cliente

---

## Inbox Unificado

### ¿Qué es el Inbox?

El **Inbox Unificado** centraliza todas las conversaciones de diferentes canales:
- 📱 **WhatsApp** (vía AssistAI)
- 📸 **Instagram** (vía AssistAI)
- 💬 **Messenger**
- 🤖 **Chat Web** (Widget integrado)

### Interfaz del Inbox

```
┌─────────────────────────────────────────────────────────────┐
│  Lista de         │   Área de Chat      │  Información     │
│  Conversaciones   │                     │  del Cliente     │
│                   │                     │                  │
│  [Conv 1] 🟢      │  Mensajes...        │  👤 Nombre       │
│  [Conv 2]         │                     │  📱 WhatsApp     │
│  [Conv 3]         │  [Escribir...]      │  📧 Email        │
└─────────────────────────────────────────────────────────────┘
```

### Funcionalidades Clave

| Función | Cómo Usarla |
|---------|-------------|
| **Sincronizar** | Botón "🔄 Sincronizar" para traer mensajes nuevos |
| **Buscar** | 🔍 Campo de búsqueda para filtrar por nombre, contacto o mensaje |
| **Filtrar por Agente** | ⚙️ Configurar qué agentes de IA ver |
| **Responder** | Escribe en el campo inferior y presiona Enter |
| **Ver Cliente** | Si el contacto está vinculado, aparece su info |
| **Crear Cliente** | Botón "➕ Crear Cliente" para nuevos contactos |

### Búsqueda Rápida

El buscador en el Inbox filtra en tiempo real por:
- Nombre del cliente
- Número de teléfono / Usuario de Instagram
- Nombre del agente IA
- Contenido de los mensajes

**Tips**:
- Escribe `+584` para filtrar por prefijo de teléfono
- Escribe `@usuario` para buscar usuarios de Instagram

### Identificación de Clientes

- **Cliente encontrado**: Muestra el nombre y botón "Ver 360°"
- **Nuevo contacto**: Muestra botón "Crear Cliente"

### Crear Cliente desde Chat

Al pulsar "➕ Crear Cliente", se abrirá un formulario mejorado donde puedes ingresar:
- **Nombre Completo**: Obligatorio.
- **Email**: Se vinculará como contacto adicional.
- **Teléfono**: Opcional, si deseas registrar un número diferente al del chat.
- **Empresa**: Nombre de la organización.
- **Notas Iniciales**: Información relevante para el equipo.

> **Nota**: El sistema vinculará automáticamente el contacto del chat (Instagram/WhatsApp) más el email y teléfono que ingreses como identidades verificadas.

---

## Tickets de Soporte

### Estados de Ticket

| Estado | Color | Significado |
|--------|-------|-------------|
| **OPEN** | 🔵 Azul | Ticket nuevo, sin asignar |
| **IN_PROGRESS** | 🟡 Amarillo | En proceso de resolución |
| **RESOLVED** | 🟢 Verde | Resuelto, pendiente de cierre |
| **CLOSED** | ⚫ Gris | Cerrado definitivamente |

### Prioridades

- 🔴 **URGENT**: Requiere atención inmediata
- 🟠 **HIGH**: Importante, resolver hoy
- 🟡 **MEDIUM**: Normal, resolver esta semana
- 🟢 **LOW**: Puede esperar

### Crear Ticket

1. Navega a **Tickets** → **"+ Nuevo Ticket"**
2. Selecciona el **Cliente**
3. Escribe el **Título** y **Descripción**
4. Asigna **Prioridad** y **Agente**
5. Guarda

### Integración con ChronusDev

Los tickets pueden crear automáticamente **tareas en ChronusDev** para tu equipo de desarrollo. Configura el `chronusDevDefaultProjectId` del cliente para habilitar esto.

---

## Leads y Embudo de Ventas

### Vista Kanban

Los leads se visualizan en un tablero Kanban con columnas:

```
NEW → CONTACTED → QUALIFIED → NEGOTIATION → WON/LOST
```

### Gestión de Leads

| Acción | Descripción |
|--------|-------------|
| **Mover** | Arrastra el lead a otra columna |
| **Editar** | Clic en el lead para ver/editar detalles |
| **Convertir** | Transforma el lead en cliente |
| **Eliminar** | Descarta el lead |

### Convertir Lead a Cliente

1. Abre el detalle del lead
2. Clic en **"Convertir a Cliente"**
3. Selecciona el plan
4. El lead se elimina y se crea el cliente

---

## Facturación

### Crear Factura

1. Ve a **Facturas** → **"+ Nueva Factura"**
2. Selecciona el cliente
3. Agrega líneas con descripción, cantidad y precio
4. El total se calcula automáticamente
5. Guarda como **Borrador** o envía

### Estados de Factura

| Estado | Significado |
|--------|-------------|
| **DRAFT** | Borrador, no enviada |
| **SENT** | Enviada al cliente |
| **PAID** | Pagada |
| **OVERDUE** | Vencida |
| **CANCELLED** | Cancelada |

---

## AssistAI - Agentes de IA

### ¿Qué es AssistAI?

AssistAI es la plataforma de agentes de IA que maneja las conversaciones automáticamente. Cada agente puede:
- Responder preguntas frecuentes
- Calificar leads
- Transferir a humanos cuando es necesario

### Ver Agentes

En la sección **AssistAI** puedes ver:
- Lista de agentes configurados
- Estadísticas por agente (conversaciones, mensajes)
- Modelo de IA utilizado

### Suscripción a Agentes

En el Inbox puedes elegir qué agentes seguir:
1. Clic en ⚙️ (configuración)
2. Activa/desactiva los agentes que quieras ver
3. Solo verás conversaciones de esos agentes

---

## Developers

### Portal de Desarrolladores

La sección **Developers** contiene:

| Recurso | URL |
|---------|-----|
| **API Docs** | `/api/docs` - Documentación Scalar |
| **OpenAPI Spec** | `/api/openapi.json` |
| **Webhook Config** | `/webhooks/assistai/config` |

### Autenticación API

```bash
# Headers requeridos para endpoints protegidos
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json
```

### Webhook para AssistAI

Configure AssistAI para enviar notificaciones a:
```
POST https://tu-dominio.com/webhooks/assistai
```

Eventos soportados:
- `new_message` - Nuevo mensaje
- `conversation.created` - Nueva conversación
- `conversation.resolved` - Conversación cerrada
- `ai.paused` - IA pausada

---

## Integraciones

### ChronusDev

ChronusCRM se integra con ChronusDev para:
- Sincronizar clientes automáticamente
- Crear tareas desde tickets
- Ver proyectos del cliente

### AssistAI

- **Sincronización**: Automática cada 5 segundos
- **Webhook**: Para updates instantáneos
- **Agentes**: Gestiona múltiples agentes de IA

### WhatsApp/Instagram

Conectados a través de AssistAI:
- Los mensajes llegan al Inbox
- Las respuestas se envían a través de AssistAI
- Soporta imágenes, audio y documentos

---

## Atajos y Tips

| Atajo | Acción |
|-------|--------|
| `Enter` | Enviar mensaje en chat |
| `Esc` | Cerrar modal |
| Click fuera | Cerrar modal |

### Mejores Prácticas

1. **Etiqueta a tus clientes** con tags para filtrar fácilmente
2. **Asigna prioridades** a los tickets para gestionar mejor
3. **Usa notas internas** para información que el cliente no ve
4. **Revisa el Dashboard** diariamente para ver métricas

---

## Soporte

¿Necesitas ayuda?
- 📧 Email: soporte@chronus.dev
- 📚 Docs: `/api/docs`
- 🔧 Issues: Contacta al equipo de desarrollo

---

*Última actualización: Enero 2026*
