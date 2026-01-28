
import { PrismaClient } from '@prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import path from 'path';

const dbPath = path.resolve(process.cwd(), 'prisma', 'dev.db');
const adapter = new PrismaLibSql({ url: `file:${dbPath}` });
const prisma = new PrismaClient({ adapter });

async function resetStatus() {
    const targetId = 'cmkrr4j0d0002gf11zh6e5k86';
    console.log(`Resetting status for ${targetId}...`);

    await prisma.integration.update({
        where: { id: targetId },
        data: {
            metadata: {
                status: 'disconnected',
                lastReset: new Date()
            }
        }
    });
    console.log('✅ Status reset to disconnected.');
}

resetStatus().finally(() => prisma.$disconnect());
