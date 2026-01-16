# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY apps/crm-frontend/package*.json ./

# Install ALL dependencies (including dev for TypeScript and Next.js build)
RUN npm ci

# Copy source code
COPY apps/crm-frontend ./

# Variables de build
ARG NEXT_PUBLIC_CRM_API_URL
ENV NEXT_PUBLIC_CRM_API_URL=${NEXT_PUBLIC_CRM_API_URL}
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

# Build Next.js
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
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3003

CMD ["node", "server.js"]
