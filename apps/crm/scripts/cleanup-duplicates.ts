
import { prisma } from '../src/db.js';

async function cleanup() {
    const keepId = 'cmkqbesqb0000uv11f5dfhagv';
    console.log(`Keeping provider: ${keepId}`);

    const result = await prisma.integration.deleteMany({
        where: {
            provider: 'WHATSMEOW',
            id: { not: keepId }
        }
    });

    console.log(`Deleted ${result.count} duplicate providers.`);
}

cleanup()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
