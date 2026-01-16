# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY apps/crm/package*.json ./

# Install ALL dependencies (including dev for TypeScript)
RUN npm ci

# Copy source code
COPY apps/crm/src ./src
COPY apps/crm/public ./public
COPY apps/crm/tsconfig.json ./

# Build TypeScript
RUN npm run build

# Production stage
FROM node:20-alpine AS runner

WORKDIR /app

# Instalar wget para health checks
RUN apk add --no-cache wget

ENV NODE_ENV=production
ENV PORT=3002

# Copy package files and install production deps only
COPY apps/crm/package*.json ./
RUN npm ci --only=production

# Copy built files and public folder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public

# Expose port
EXPOSE 3002

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget -q --spider http://localhost:3002/health || exit 1

# Start the server
CMD ["npm", "start"]
