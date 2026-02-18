# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copiar package files
COPY package*.json ./
COPY apps/backend/package*.json ./apps/backend/

# Instalar dependencias
RUN npm ci --workspace=apps/backend

# Copiar código fuente del backend
COPY apps/backend ./apps/backend

# Build TypeScript
RUN npm run --workspace=apps/backend build

# Production stage
FROM node:20-alpine AS runner

WORKDIR /app

# Instalar runtime dependencies
RUN apk add --no-cache wget openssl ca-certificates

# Copiar package files
COPY package*.json ./
COPY apps/backend/package*.json ./apps/backend/

# Instalar solo producción
RUN npm ci --workspace=apps/backend --omit=dev

# Copiar Prisma Client generado del builder
COPY --from=builder /app/node_modules/.prisma /app/node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma/client /app/node_modules/@prisma/client

# Copiar carpeta prisma para migraciones
COPY --from=builder /app/apps/backend/prisma ./apps/backend/prisma

# Copiar build
COPY --from=builder /app/apps/backend/dist ./apps/backend/dist

# Eliminar binarios incompatibles de Prisma (Forzar uso de OpenSSL 3.0)
RUN rm -f /app/node_modules/.prisma/client/*openssl-1.1.x*

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

CMD ["sh", "-c", "npx prisma migrate deploy --schema=apps/backend/prisma/schema.prisma && node apps/backend/dist/src/index.js"]
