# Build Stage
FROM node:20-bookworm-slim AS builder

# Install build dependencies
RUN apt-get update && apt-get install -y openssl python3 make g++

WORKDIR /app

# Copy root package files
COPY package*.json ./

# Copy app package files
COPY apps/crm/package*.json ./apps/crm/
COPY apps/crm/prisma ./apps/crm/prisma/

# Install dependencies (Monorepo aware)
RUN npm ci --workspace=apps/crm

# Copy source code
COPY apps/crm ./apps/crm

# Generate Prisma Client
RUN npx prisma generate --schema=apps/crm/prisma/schema.prisma

# Build
RUN npm run --workspace=apps/crm build

# Production Stage
FROM node:20-bookworm-slim
WORKDIR /app

# Install runtime dependencies
RUN apt-get update && apt-get install -y openssl curl ca-certificates

# Copy package files
COPY package*.json ./
COPY apps/crm/package*.json ./apps/crm/

# Install production dependencies
RUN npm ci --workspace=apps/crm --omit=dev

# Copy built artifacts and prisma
COPY --from=builder /app/apps/crm/dist ./apps/crm/dist
COPY --from=builder /app/apps/crm/prisma ./apps/crm/prisma
# Copy entrypoint from source
COPY --from=builder /app/apps/crm/entrypoint.sh ./apps/crm/entrypoint.sh

ENV NODE_ENV=production
ENV PORT=3002

EXPOSE 3002

WORKDIR /app/apps/crm
RUN chmod +x entrypoint.sh

ENTRYPOINT ["./entrypoint.sh"]
CMD ["node", "dist/index.js"]
