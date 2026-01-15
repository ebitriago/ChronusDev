# Plan de Implementación - ChronusDev v2

## Resumen de funcionalidades solicitadas

El usuario quiere expandir el MVP con:

1. **CRUD Completo:**
   - Clientes
   - Proyectos  
   - Usuarios (devs, trabajadores)

2. **Relaciones y funcionalidades:**
   - Agregar devs a proyectos
   - Ver tareas por proyecto
   - Comentar en tarjetas Kanban
   - Tomar/asignar tareas
   - Clientes con múltiples proyectos
   - Tarifas: Pay Rate (lo que se paga) y Bill Rate (lo que se cobra)
     - Por dev, por cliente, por proyecto
   - Budget por proyecto
   - Sistema de usuarios e invitaciones
   - Login sencillo
   - Invitaciones a proyectos/organizaciones
   - Ver progreso de proyectos

## Estado Actual

- ✅ Modelos de datos creados (types.ts)
- ✅ Datos en memoria estructurados (data.ts)
- ✅ Utilidades (utils.ts)
- ⏳ Backend principal necesita reescritura completa

## Próximos Pasos

1. Crear nuevo index.ts con todos los endpoints CRUD
2. Implementar autenticación básica
3. Sistema de invitaciones
4. Comentarios en tareas
5. Sistema de tarifas flexible
6. Progreso de proyectos
7. Actualizar frontend

## Nota

Esta es una expansión significativa del MVP. Se recomienda implementar por fases para mantener el código mantenible.
