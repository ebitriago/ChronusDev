#!/bin/sh

echo "🚀 [FIX-v2] Starting CRM Backend Initializer (Debian Edition)..."
echo "📂 Current directory: $(pwd)"

# Ensure DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo "❌ Error: DATABASE_URL is not set!"
  exit 1
fi
echo "🔗 Prisma will connect to: $DATABASE_URL"

echo "📄 Checking for schema at ./prisma/schema.prisma"
if [ ! -f "./prisma/schema.prisma" ]; then
  echo "❌ Error: schema.prisma not found!"
  exit 1
fi

# Run prisma db push (with Retry Logic)
echo "📂 Syncing database schema with Prisma..."
MAX_RETRIES=30
RETRY_COUNT=0

until npx prisma db push --accept-data-loss; do
  RETRY_COUNT=$((RETRY_COUNT+1))
  if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
    echo "❌ Error: Prisma db push failed after $MAX_RETRIES attempts!"
    exit 1
  fi
  echo "⏳ Database not ready yet, retrying in 2 seconds... ($RETRY_COUNT/$MAX_RETRIES)"
  sleep 2
done

echo "✅ Database schema synced!"

# Start the application
echo "⚡ Starting application with: $@"
exec "$@"
