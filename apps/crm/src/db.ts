// Prisma Client Singleton for the CRM Backend (Prisma 7 with LibSQL adapter)
import { PrismaClient } from '@prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// SQLite file path
const dbPath = path.join(__dirname, '..', 'prisma', 'dev.db');

// Prisma adapter factory (Prisma 7 style)
const adapter = new PrismaLibSql({ url: `file:${dbPath}` });

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
