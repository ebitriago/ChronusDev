// Prisma Client Singleton for ChronusDev Backend
import { PrismaClient } from '@prisma/client';

const databaseUrl = process.env.CHRONUSDEV_DATABASE_URL;

if (!databaseUrl) {
    throw new Error('CHRONUSDEV_DATABASE_URL is not set');
}

console.log('🔌 [ChronusDev DB] Connecting to:', databaseUrl.replace(/:[^:@]*@/, ':****@'));

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
    globalForPrisma.prisma ||
    new PrismaClient({
        log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    });

prisma.$connect()
    .then(() => console.log('✅ [ChronusDev DB] Successfully connected to PostgreSQL'))
    .catch((e: any) => console.error('❌ [ChronusDev DB] Connection failed:', e));

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;
