// Prisma Client Singleton for the CRM Backend
import { PrismaClient } from '@prisma/client';
// import { PrismaPg } from '@prisma/adapter-pg';
// import pg from 'pg';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set');
}

console.log('🔌 [DB] Connecting to:', databaseUrl.replace(/:[^:@]*@/, ':****@')); // Hide password


// Prevent multiple instances during development hot-reload
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
    globalForPrisma.prisma ||
    new PrismaClient({
        log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    });

// Test connection
prisma.$connect()
    .then(() => console.log('✅ [DB] Successfully connected to PostgreSQL'))
    .catch((e: any) => console.error('❌ [DB] Connection failed:', e));

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;
