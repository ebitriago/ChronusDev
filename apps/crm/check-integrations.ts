
import { prisma } from './src/db.js';

async function check() {
    const integrations = await prisma.integration.findMany({
        where: { provider: 'ASSISTAI' },
        include: { organization: true }
    });
    console.log('AssistAI Integrations:', JSON.stringify(integrations, null, 2));

    const orgs = await prisma.organization.findMany();
    console.log('Total Orgs:', orgs.length);
}

check().catch(console.error).finally(() => prisma.$disconnect());
