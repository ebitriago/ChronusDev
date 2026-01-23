# Manual de Usuario: Integraciones de IA

## 🤖 Introducción

Este manual describe el uso de las integraciones de Inteligencia Artificial en tu ChronusCRM: **AssistAI** para mensajería (WhatsApp/Instagram), **ElevenLabs** para agentes de voz, y **WhatsMeow** para WhatsApp directo.

## 🚀 Funcionalidades Clave

### 1. Gestión de Agentes (AssistAI)
En la pestaña **AssistAI** del CRM, puedes visualizar todos tus agentes configurados.
- **Estado**: Verifica si están activos.
- **Sincronización**: Usa el botón "Sincronizar Todo" para actualizar la lista de agentes y conversaciones recientes.

### 2. Bandeja de Entrada Unificada (Inbox)
Todas las conversaciones iniciadas por tus agentes de IA aparecen automáticamente en el Inbox del CRM.
- **Identificación Clara**: Cada chat muestra si proviene de WhatsApp o Instagram.
- **Intervención**: Puedes responder directamente desde el Inbox.

### 3. Agente de Voz (ElevenLabs)
Interactúa verbalmente con tu IA directamente desde el Dashboard.
- **Widget de Voz**: Un botón flotante en la esquina inferior derecha del Dashboard te permite iniciar una llamada de voz con el agente configurado.
- **Validación**: El sistema verifica que el Agente ID sea válido antes de permitir su uso.

### 4. WhatsApp Directo (WhatsMeow)
Envía mensajes de WhatsApp directamente desde el CRM usando tu número personal o de negocio.
- **Conexión por QR**: Vincula tu WhatsApp escaneando un código QR.
- **Mensajes Multimedia**: Envía texto, imágenes, audio, documentos y video.
- **Sin API Empresarial**: Usa tu número personal sin necesidad de WhatsApp Business API.

## ⚙️ Configuración

### Conectar AssistAI
1.  Ve a **Configuración > Integraciones**.
2.  En la tarjeta **AssistAI**, haz clic en **Configurar**.
3.  Ingresa: `API Token`, `Tenant Domain`, `Organization Code`.
4.  Guarda los cambios.

### Conectar ElevenLabs (Voz)
1.  Ve a **Configuración > Integraciones**.
2.  En la tarjeta **ElevenLabs Voice**, haz clic en **Configurar**.
3.  Ingresa tu `API Key` de ElevenLabs.
4.  Ingresa el `Agent ID` de tu agente de voz conversacional.
    *   *Nota*: Asegúrate de que tu agente en ElevenLabs tenga configurado Twilio (u otro proveedor) si deseas que realice llamadas telefónicas reales. El CRM solo inicia la interfaz de voz web.
5.  Haz clic en **"Validar Agente"** para confirmar la conexión.
6.  Guarda los cambios.

### Conectar WhatsApp (WhatsMeow)
1.  Ve a **Configuración > Integraciones**.
2.  En la tarjeta **WhatsApp (WhatsMeow)**, haz clic en **Configurar**.
3.  Haz clic en **"Crear Agente WhatsApp"** para generar tu agente.
4.  Escanea el código QR que aparece con la app de WhatsApp en tu celular:
    - Abre WhatsApp en tu teléfono.
    - Ve a **Configuración > Dispositivos vinculados**.
    - Toca **Vincular un dispositivo**.
    - Escanea el QR mostrado en el CRM.
5.  Haz clic en **"Verificar Conexión"** para confirmar que tu WhatsApp está vinculado.

#### Enviar Mensajes por WhatsApp
Una vez conectado, puedes enviar mensajes desde el CRM:
- **Mensajes de texto**: Escribe y envía mensajes directos a cualquier número.
- **Imágenes**: Comparte imágenes con subtítulos opcionales.
- **Documentos**: Envía PDFs, archivos Excel, Word, etc.
- **Audio**: Envía notas de voz o archivos de audio.

> ⚠️ **Importante**: Mantén WhatsApp abierto en tu teléfono para garantizar la conexión. Si cierras la sesión en el teléfono, deberás volver a escanear el QR.

---
*Para soporte técnico avanzado o dudas sobre la API, consulta a tu administrador del sistema.*

