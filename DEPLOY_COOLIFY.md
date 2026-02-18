# ChronusDev + ChronusCRM - Guía de Despliegue en Coolify

## 🐳 Opción 1: Despliegue con Docker Compose (Recomendado)

### Paso 1: Subir a Coolify como Docker Compose

1. En Coolify: **New Resource** → **Docker Compose**
2. Conecta tu repositorio: `https://github.com/ebitriago/ChronusDev`
3. Coolify detectará automáticamente el `docker-compose.yml` o `docker-compose.yaml`
   - ⚠️ **Nota**: El proyecto incluye ambos archivos (`.yml` y `.yaml`) para compatibilidad. Ambos apuntan al mismo contenido.

### Paso 2: Configurar Variables de Entorno

Copia el contenido de `.env.example` a las variables de Coolify:

```env
# Security
JWT_SECRET=tu-clave-secreta-super-segura

# URLs externas (dominios públicos)
CHRONUSDEV_API_URL=https://api.chronusdev.com
CHRONUSCRM_API_URL=https://api.crm.chronusdev.com

# CRM -> Dev Integration
CHRONUSDEV_TOKEN=token-admin-123

# AssistAI
ASSISTAI_API_URL=https://public.assistai.lat
ASSISTAI_API_TOKEN=tu-token-de-assistai
ASSISTAI_TENANT_DOMAIN=ce230715ba86721e
ASSISTAI_ORG_CODE=d59b32edfb28e130
```

### Paso 3: Configurar Dominios en Coolify

| Puerto | Servicio | Dominio |
|--------|----------|------------------|
| 3000 | ChronusDev Frontend | `chronusdev.assistai.work` |
| 3001 | ChronusDev Backend | `chronusdev.assistai.work/api` |
| 3002 | ChronusCRM Backend | `chronuscrm.assistai.work/api` |
| 3003 | ChronusCRM Frontend | `chronuscrm.assistai.work` |

### Paso 4: Deploy

Click **Deploy** y espera a que los 4 contenedores estén healthy.

---

## 📦 Opción 2: Servicios Individuales

| Servicio | Puerto | Directorio |
|----------|--------|------------|
| ChronusDev Backend | 3001 | `apps/backend` |
| ChronusDev Frontend | 3000 | `apps/frontend` |
| ChronusCRM Backend | 3002 | `apps/crm` |
| ChronusCRM Frontend | 3003 | `apps/crm-frontend` |

---

## 🔧 Paso 1: Configurar Repositorio en Coolify

1. Ve a **Coolify Dashboard** → **New Resource** → **Application**
2. Conecta tu repositorio: `https://github.com/ebitriago/ChronusDev`
3. Selecciona branch: `main`

---

## 🚀 Paso 2: Crear las 4 Aplicaciones

### 2.1 ChronusDev Backend (API Principal)

| Campo | Valor |
|-------|-------|
| **Nombre** | `chronusdev-backend` |
| **Base Directory** | `apps/backend` |
| **Build Command** | `npm install && npm run build` |
| **Start Command** | `npm start` |
| **Port** | `3001` |

**Variables de Entorno:**
```
PORT=3001
NODE_ENV=production
JWT_SECRET=tu_jwt_secret_seguro
```

---

### 2.2 ChronusDev Frontend (Next.js)

| Campo | Valor |
|-------|-------|
| **Nombre** | `chronusdev-frontend` |
| **Base Directory** | `apps/frontend` |
| **Build Pack** | Nixpacks o Dockerfile |
| **Build Command** | `npm install && npm run build` |
| **Start Command** | `npm start` |
| **Port** | `3000` |

**Variables de Entorno:**
```
NEXT_PUBLIC_API_URL=https://api.chronusdev.tudominio.com
```

---

### 2.3 ChronusCRM Backend (API CRM + Socket.io)

| Campo | Valor |
|-------|-------|
| **Nombre** | `chronuscrm-backend` |
| **Base Directory** | `apps/crm` |
| **Build Command** | `npm install && npm run build` |
| **Start Command** | `npm start` |
| **Port** | `3002` |

**Variables de Entorno:**
```
PORT=3002
NODE_ENV=production
CHRONUSDEV_URL=https://api.chronusdev.tudominio.com
CHRONUSDEV_TOKEN=token-admin-123

# AssistAI Integration
ASSISTAI_API_URL=https://public.assistai.lat
ASSISTAI_API_TOKEN=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
ASSISTAI_TENANT_DOMAIN=ce230715ba86721e
ASSISTAI_ORG_CODE=d59b32edfb28e130
```

> ⚠️ **Importante**: Este servicio usa Socket.io. Asegúrate de que WebSockets estén habilitados en tu proxy (Traefik/Nginx).

---

### 2.4 ChronusCRM Frontend (Next.js)

| Campo | Valor |
|-------|-------|
| **Nombre** | `chronuscrm-frontend` |
| **Base Directory** | `apps/crm-frontend` |
| **Build Pack** | Nixpacks o Dockerfile |
| **Build Command** | `npm install && npm run build` |
| **Start Command** | `npm start` |
| **Port** | `3003` |

**Variables de Entorno:**
```
NEXT_PUBLIC_CRM_API_URL=https://api.chronuscrm.tudominio.com
```

---

## 🌐 Paso 3: Configurar Dominios

Ejemplo de configuración DNS:

| Subdominio | Servicio |
|------------|----------|
| `chronusdev.assistai.work` | ChronusDev Frontend |
| `chronusdev.assistai.work/api` | ChronusDev Backend |
| `chronuscrm.assistai.work` | ChronusCRM Frontend |
| `chronuscrm.assistai.work/api` | ChronusCRM Backend |

En Coolify, para cada app:
1. Ve a **Domains**
2. Agrega tu dominio con certificado SSL automático

---

## 🔌 Paso 4: Habilitar WebSockets (Crítico para Chat)

### Para Traefik (default en Coolify):
Los WebSockets deberían funcionar automáticamente.

### Si usas Nginx como proxy adicional:
```nginx
location /socket.io/ {
    proxy_pass http://chronuscrm-backend:3002;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
}
```

---

## ✅ Paso 5: Verificar Despliegue

Después de desplegar, verifica cada servicio:

```bash
# Backend ChronusDev
curl https://api.chronusdev.com/health

# Backend CRM
curl https://api.crm.chronusdev.com/health

# AssistAI Integration
curl https://api.crm.chronusdev.com/assistai/agents
```

---

## 🤖 Paso 6: Configurar Webhook de AssistAI

Para que AssistAI envíe mensajes a tu CRM, configura en su plataforma:

**Webhook URL:**
```
POST https://api.crm.chronusdev.com/webhooks/messages/incoming
```

**Payload de ejemplo:**
```json
{
  "from": "+584121234567",
  "content": "Hola, necesito ayuda",
  "platform": "whatsapp",
  "agentCode": "38656cbf557943f9",
  "agentName": "Claudia"
}
```

---

## 📝 Notas Adicionales

- **SSL**: Coolify genera certificados Let's Encrypt automáticamente
- **Logs**: Ve a cada app → Logs para debugging
- **Redeploy**: Push a `main` triggerea rebuild automático si configuras webhook de GitHub
- **Recursos mínimos**: 512MB RAM por servicio (recomendado 1GB para frontends Next.js)

---

## 🆘 Troubleshooting

| Problema | Solución |
|----------|----------|
| Socket.io no conecta | Verificar que WebSockets estén habilitados en proxy |
| 502 Bad Gateway | Verificar que el puerto esté correcto y la app esté corriendo |
| Variables no cargan | Verificar que estén en la sección correcta (Build vs Runtime) |
| AssistAI error 500 | Es bug de ellos en `/conversations`, contactar su soporte |
