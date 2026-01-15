# ✅ ChronusDev MVP - Listo para Probar

## 🚀 Inicio Rápido

```bash
cd /Users/eduardobitriagoe/chronusdev

# Terminal 1 - Backend
npm run dev:backend

# Terminal 2 - Frontend  
npm run dev:frontend
```

Luego abre: **http://localhost:3000**

## ✨ Funcionalidades Implementadas

### ✅ CRUD Completo
- **Clientes**: Crear, editar, eliminar, listar
- **Usuarios**: Crear usuarios (Admin)
- **Proyectos**: CRUD completo con presupuesto
- **Tareas**: CRUD con asignación, prioridades, tiempo estimado

### ✅ Autenticación Simple
- Login por email (se crea automáticamente si no existe)
- Tokens de sesión
- Protección de rutas por roles

### ✅ Sistema de Tarifas
- **Pay Rate**: Lo que se paga al dev ($/hr)
- **Bill Rate**: Lo que se cobra al cliente ($/hr)
- Tarifas configurables por proyecto y usuario

### ✅ Gestión de Proyectos
- Agregar devs a proyectos con tarifas
- Presupuesto por proyecto
- Seguimiento de consumo en tiempo real
- Progreso basado en tareas completadas

### ✅ Tareas Mejoradas
- Asignación de tareas ("Tomar tarea")
- Comentarios en tarjetas Kanban
- Tiempo acumulado vs estimado
- Prioridades (LOW, MEDIUM, HIGH, URGENT)
- Estados: BACKLOG, TODO, IN_PROGRESS, REVIEW, DONE

### ✅ Timer
- Timer flotante siempre visible
- Modal de notas al detener
- Cálculo automático de costos

### ✅ Dashboard Admin
- Gráficos de presupuesto vs consumo
- Semáforo de estado (Verde/Amarillo/Rojo)
- Exportar CSV para nómina

## 🔐 Usuarios de Prueba

El sistema viene con datos de ejemplo:
- **Admin**: `admin@chronusdev.com` 
- **Dev**: `juan@chronusdev.com`

Para MVP: Puedes usar cualquier email y se creará automáticamente como DEV.

## 📝 Próximos Pasos (Mejoras Futuras)

- [ ] Invitaciones por email
- [ ] Notificaciones
- [ ] Generación real de PDFs
- [ ] Base de datos persistente
- [ ] Filtros y búsqueda avanzada
- [ ] Reportes más detallados

## 🐛 Solución de Problemas

Si no inicia:
1. Verifica que Node.js esté instalado: `node --version`
2. Instala dependencias: `npm install` en raíz y en cada app
3. Verifica puertos libres: `lsof -ti:3000,3001`

¡Listo para usar! 🎉
