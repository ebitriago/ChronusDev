# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root package files
COPY package*.json ./

# Copy app package files
COPY apps/crm-frontend/package*.json ./apps/crm-frontend/

# Install dependencies (Monorepo aware)
RUN npm ci --workspace=apps/crm-frontend

# Copy source code
COPY apps/crm-frontend ./apps/crm-frontend

# Variables de build
ARG NEXT_PUBLIC_CRM_API_URL
ENV NEXT_PUBLIC_CRM_API_URL=${NEXT_PUBLIC_CRM_API_URL}
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

# Build Next.js
RUN npm run --workspace=apps/crm-frontend build

# Production stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3003

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy necessary files from builder
COPY --from=builder --chown=nextjs:nodejs /app/apps/crm-frontend/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/crm-frontend/.next/static ./apps/crm-frontend/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/crm-frontend/public ./apps/crm-frontend/public

USER nextjs

EXPOSE 3003

CMD ["node", "apps/crm-frontend/server.js"]
