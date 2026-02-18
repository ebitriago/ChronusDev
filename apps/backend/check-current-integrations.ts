import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function check() {
    console.log('🔍 Checking all AssistAI integrations...\n');
    
    const integrations = await prisma.integration.findMany({
        where: { provider: 'ASSISTAI' },
        include: { organization: true }
    });
    
    console.log(`Found ${integrations.length} AssistAI integrations:\n`);
    integrations.forEach((i, idx) => {
        console.log(`${idx + 1}. Organization: ${i.organization?.name || 'N/A'}`);
        console.log(`   ID: ${i.organizationId}`);
        console.log(`   Enabled: ${i.isEnabled}`);
        console.log(`   Created: ${i.createdAt}`);
        const creds = i.credentials as any;
        console.log(`   Tenant: ${creds?.tenantDomain || 'N/A'}`);
        console.log(`   Org Code: ${creds?.organizationCode || 'N/A'}`);
        console.log('');
    });
    
    await prisma.$disconnect();
}

check();
