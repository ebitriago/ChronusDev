import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function check() {
    console.log('🔍 Checking integrations...\n');
    
    // List all AssistAI integrations
    const integrations = await prisma.integration.findMany({
        where: { provider: 'ASSISTAI' },
        include: { organization: true }
    });
    
    console.log(`Found ${integrations.length} AssistAI integrations:\n`);
    integrations.forEach(i => {
        console.log(`  - Org: ${i.organization?.name || 'N/A'} (${i.organizationId})`);
        console.log(`    Enabled: ${i.isEnabled}`);
        console.log(`    Has credentials: ${!!i.credentials}`);
        console.log('');
    });
    
    // List all organizations
    console.log('All organizations:');
    const orgs = await prisma.organization.findMany({
        select: { id: true, name: true }
    });
    orgs.forEach(o => console.log(`  - ${o.name} (${o.id})`));
    
    await prisma.$disconnect();
}

check();
