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

# Instalar wget para health checks
RUN apk add --no-cache wget

# Copiar package files
COPY package*.json ./
COPY apps/backend/package*.json ./apps/backend/

# Instalar solo producción
RUN npm ci --workspace=apps/backend --omit=dev

# Copiar build
COPY --from=builder /app/apps/backend/dist ./apps/backend/dist

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

CMD ["node", "apps/backend/dist/index.js"]
