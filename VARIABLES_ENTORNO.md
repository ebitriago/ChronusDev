# 🔐 Variables de Entorno para Coolify

## 📋 Resumen de Variables

### Variables Globales (Configurar en Coolify)

Estas variables se configuran una vez en Coolify y se aplican a todos los servicios del Docker Compose:

```env
# ==========================================================
# SEGURIDAD
# ==========================================================
JWT_SECRET=tu-clave-secreta-super-segura-minimo-32-caracteres

# ==========================================================
# URLs PÚBLICAS (Dominios que configurarás en Coolify)
# ==========================================================
# URL pública del backend de ChronusDev
CHRONUSDEV_API_URL=https://api.chronusdev.tudominio.com

# URL pública del backend del CRM
CHRONUSCRM_API_URL=https://api.crm.chronusdev.tudominio.com

# ==========================================================
# INTEGRACIÓN CRM -> ChronusDev
# ==========================================================
# Token para que el CRM backend se comunique con ChronusDev backend
CHRONUSDEV_TOKEN=token-admin-123

# ==========================================================
# INTEGRACIÓN ASSISTAI (Opcional - Solo si usas el CRM con chat)
# ==========================================================
ASSISTAI_API_URL=https://public.assistai.lat
ASSISTAI_API_TOKEN=tu-token-de-assistai-aqui
ASSISTAI_TENANT_DOMAIN=ce230715ba86721e
ASSISTAI_ORG_CODE=d59b32edfb28e130
```

---

## 🎯 Variables por Servicio

### 1. **chronusdev-backend** (Puerto 3001)

**Variables internas (ya configuradas en docker-compose.yml):**
- `NODE_ENV=production`
- `PORT=3001`
- `JWT_SECRET=${JWT_SECRET}` ← Usa la variable global

**No requiere configuración adicional en Coolify** ✅

---

### 2. **chronusdev-frontend** (Puerto 3000)

**Variables internas:**
- `NODE_ENV=production`
- `NEXT_PUBLIC_API_URL=${CHRONUSDEV_API_URL}` ← Usa la variable global

**⚠️ IMPORTANTE:** 
- En **desarrollo local**: `CHRONUSDEV_API_URL=http://chronusdev-backend:3001` (URL interna)
- En **producción (Coolify)**: `CHRONUSDEV_API_URL=https://api.chronusdev.tudominio.com` (URL pública con dominio)

**Configurar en Coolify:**
```env
CHRONUSDEV_API_URL=https://api.chronusdev.tudominio.com
```

---

### 3. **chronuscrm-backend** (Puerto 3002)

**Variables internas:**
- `NODE_ENV=production`
- `PORT=3002`
- `CHRONUSDEV_URL=http://chronusdev-backend:3001` ← URL interna (no cambiar)
- `CHRONUSDEV_TOKEN=${CHRONUSDEV_TOKEN}` ← Usa la variable global
- `ASSISTAI_API_URL=${ASSISTAI_API_URL}` ← Usa la variable global
- `ASSISTAI_API_TOKEN=${ASSISTAI_API_TOKEN}` ← Usa la variable global
- `ASSISTAI_TENANT_DOMAIN=${ASSISTAI_TENANT_DOMAIN}` ← Usa la variable global
- `ASSISTAI_ORG_CODE=${ASSISTAI_ORG_CODE}` ← Usa la variable global

**Configurar en Coolify:**
```env
CHRONUSDEV_TOKEN=token-admin-123
ASSISTAI_API_URL=https://public.assistai.lat
ASSISTAI_API_TOKEN=tu-token-aqui
ASSISTAI_TENANT_DOMAIN=ce230715ba86721e
ASSISTAI_ORG_CODE=d59b32edfb28e130
```

---

### 4. **chronuscrm-frontend** (Puerto 3003)

**Variables internas:**
- `NODE_ENV=production`
- `PORT=3003`
- `NEXT_PUBLIC_CRM_API_URL=${CHRONUSCRM_API_URL}` ← Usa la variable global

**⚠️ NOTA IMPORTANTE:**
El CRM frontend también necesita acceso al backend de ChronusDev para el panel de SuperAdmin (organizaciones). Actualmente usa `NEXT_PUBLIC_API_URL` en `SuperAdminPanel.tsx`, pero esto debería configurarse también.

**Configurar en Coolify:**
```env
CHRONUSCRM_API_URL=https://api.crm.chronusdev.tudominio.com
CHRONUSDEV_API_URL=https://api.chronusdev.tudominio.com  # Para SuperAdminPanel
```

---

## 🚀 Configuración en Coolify

### Paso 1: Crear el Recurso Docker Compose

1. En Coolify: **New Resource** → **Docker Compose**
2. Conecta tu repositorio
3. Coolify detectará el `docker-compose.yml`

### Paso 2: Agregar Variables de Entorno

En la sección **Environment Variables** del recurso Docker Compose, agrega:

```env
# Seguridad
JWT_SECRET=genera-una-clave-secreta-super-larga-y-segura-aqui

# URLs públicas (reemplaza con tus dominios reales)
CHRONUSDEV_API_URL=https://api.chronusdev.tudominio.com
CHRONUSCRM_API_URL=https://api.crm.chronusdev.tudominio.com

# Integración CRM -> Dev
CHRONUSDEV_TOKEN=token-admin-123

# AssistAI (opcional)
ASSISTAI_API_URL=https://public.assistai.lat
ASSISTAI_API_TOKEN=tu-token-de-assistai
ASSISTAI_TENANT_DOMAIN=ce230715ba86721e
ASSISTAI_ORG_CODE=d59b32edfb28e130
```

### Paso 3: Configurar Dominios

Para cada servicio, configura el dominio en Coolify:

| Servicio | Puerto | Dominio Sugerido |
|----------|--------|------------------|
| `chronusdev-frontend` | 3000 | `app.chronusdev.tudominio.com` |
| `chronusdev-backend` | 3001 | `api.chronusdev.tudominio.com` |
| `chronuscrm-frontend` | 3003 | `crm.chronusdev.tudominio.com` |
| `chronuscrm-backend` | 3002 | `api.crm.chronusdev.tudominio.com` |

**⚠️ IMPORTANTE:** Las URLs en `CHRONUSDEV_API_URL` y `CHRONUSCRM_API_URL` deben coincidir con los dominios que configures en Coolify.

---

## 🔍 Verificación

Después del despliegue, verifica que las variables estén correctas:

```bash
# Backend ChronusDev
curl https://api.chronusdev.tudominio.com/health

# Backend CRM
curl https://api.crm.chronusdev.tudominio.com/health
```

---

## 📝 Notas Importantes

1. **URLs Internas vs Públicas:**
   - Dentro de Docker: Los servicios se comunican usando nombres de servicio (`chronusdev-backend:3001`)
   - Desde el navegador: Los frontends necesitan URLs públicas con HTTPS

2. **JWT_SECRET:**
   - Debe ser una cadena larga y aleatoria (mínimo 32 caracteres)
   - Genera una nueva para producción: `openssl rand -base64 32`

3. **AssistAI:**
   - Solo necesario si usas el módulo de chat del CRM
   - Si no lo usas, puedes dejar esas variables vacías o no configurarlas

4. **CHRONUSDEV_TOKEN:**
   - Token de autenticación para que el CRM backend se comunique con ChronusDev backend
   - Debe coincidir con un token válido en el sistema

---

## 🐛 Troubleshooting

### Problema: Frontend no puede conectar con el backend

**Solución:** Verifica que `CHRONUSDEV_API_URL` y `CHRONUSCRM_API_URL` apunten a las URLs públicas correctas (con HTTPS y el dominio configurado en Coolify).

### Problema: CRM no puede comunicarse con ChronusDev

**Solución:** Verifica que `CHRONUSDEV_TOKEN` esté configurado y sea válido. El CRM backend usa la URL interna `http://chronusdev-backend:3001` (correcto, no cambiar).

### Problema: WebSockets no funcionan en el chat

**Solución:** Asegúrate de que el proxy de Coolify (Traefik) tenga habilitados los WebSockets. Debería funcionar automáticamente, pero verifica los logs del servicio `chronuscrm-backend`.

