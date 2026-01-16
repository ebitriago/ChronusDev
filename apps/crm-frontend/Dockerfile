# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root package files for workspace
COPY package*.json ./
COPY apps/crm-frontend/package*.json ./apps/crm-frontend/

# Install dependencies
RUN npm ci --workspace=apps/crm-frontend || npm install

# Copy source code
COPY apps/crm-frontend ./apps/crm-frontend

# Variables de build
ARG NEXT_PUBLIC_CRM_API_URL
ENV NEXT_PUBLIC_CRM_API_URL=${NEXT_PUBLIC_CRM_API_URL}
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

# Build Next.js
WORKDIR /app/apps/crm-frontend
RUN npm run build

# Production stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3003

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy necessary files from builder
COPY --from=builder /app/apps/crm-frontend/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/apps/crm-frontend/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/crm-frontend/.next/static ./.next/static

USER nextjs

EXPOSE 3003

CMD ["node", "server.js"]
