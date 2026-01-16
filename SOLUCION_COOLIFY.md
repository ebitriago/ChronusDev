# 🔧 Solución al Error de Docker Compose en Coolify

## ❌ Problema

Coolify estaba buscando el archivo `/docker-compose.yaml` (con extensión `.yaml`) pero el proyecto solo tenía `docker-compose.yml` (con extensión `.yml`).

**Error:**
```
Deployment failed: Docker Compose file not found at: /docker-compose.yaml
Check if you used the right extension (.yaml or .yml) in the compose file name.
```

## ✅ Solución Implementada

Se creó un symlink `docker-compose.yaml` que apunta a `docker-compose.yml` para mantener compatibilidad con ambos formatos.

### Verificación

```bash
ls -la docker-compose.*
# Debería mostrar:
# docker-compose.yaml -> docker-compose.yml
# docker-compose.yml
```

## 📝 Notas Importantes

1. **Symlinks en Git**: El symlink está incluido en el repositorio. Si al clonar el repositorio el symlink no funciona (por ejemplo, en Windows sin permisos de symlink), puedes crear uno manualmente:

   ```bash
   ln -s docker-compose.yml docker-compose.yaml
   ```

   O simplemente copiar el archivo:

   ```bash
   cp docker-compose.yml docker-compose.yaml
   ```

2. **Mantenimiento**: Si editas `docker-compose.yml`, el symlink automáticamente reflejará los cambios. Si por alguna razón necesitas tener ambos archivos como copias separadas, asegúrate de mantenerlos sincronizados.

3. **Coolify**: Ahora Coolify debería detectar el archivo correctamente y el despliegue debería funcionar.

## 🚀 Próximos Pasos

1. Haz commit y push del symlink:
   ```bash
   git add docker-compose.yaml
   git commit -m "Add docker-compose.yaml symlink for Coolify compatibility"
   git push
   ```

2. En Coolify, intenta desplegar nuevamente. Debería detectar el archivo correctamente.

3. Si aún hay problemas, verifica en Coolify:
   - Que el repositorio esté correctamente conectado
   - Que el branch sea el correcto (probablemente `main`)
   - Que el archivo esté en la raíz del repositorio

