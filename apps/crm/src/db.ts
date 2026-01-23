// Prisma Client Singleton for the CRM Backend (Prisma 7 with LibSQL adapter)
import { PrismaClient } from '@prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import path from 'path';

// SQLite file path - use process.cwd() for reliability with tsx watch
const dbPath = path.resolve(process.cwd(), 'prisma', 'dev.db');
const dbUrl = `file:${dbPath}`;

console.log(`[DB] Connecting to SQLite at: ${dbUrl}`);

// Create adapter directly with URL (PrismaLibSql handles libsql client internally in v7.3.0)
const adapter = new PrismaLibSql({ url: dbUrl });

// Prevent multiple instances during development hot-reload
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
    globalForPrisma.prisma ||
    new PrismaClient({
        adapter,
        log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;
