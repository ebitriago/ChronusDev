// Quick test of agent sync
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function syncAgents() {
    const orgId = 'cml307egh000301pd2qvjtaga'; // Org de Admin Chronus

    console.log('🔍 Testing AssistAI agent sync...\n');

    // Get integration
    const integration = await prisma.integration.findFirst({
        where: {
            organizationId: orgId,
            provider: 'ASSISTAI'
        }
    });

    if (!integration) {
        console.error('❌ No integration found');
        return;
    }

    const creds = integration.credentials as any;
    const headers = {
        'Authorization': `Bearer ${creds.apiToken}`,
        'x-tenant-domain': creds.tenantDomain,
        'x-organization-code': creds.organizationCode,
        'Content-Type': 'application/json',
    };

    // Fetch agents from AssistAI
    const response = await fetch('https://public.assistai.lat/api/v1/agents', { headers });
    const data = await response.json();

    console.log(`Found ${data.data?.length} agents from AssistAI\n`);

    // Sync them
    for (const remoteAgent of data.data || []) {
        const existing = await prisma.aiAgent.findFirst({
            where: {
                organizationId: orgId,
                config: {
                    path: ['assistaiCode'],
                    equals: remoteAgent.code
                }
            }
        });

        if (existing) {
            console.log(`  ✓ ${remoteAgent.name} (already synced)`);
        } else {
            await prisma.aiAgent.create({
                data: {
                    organizationId: orgId,
                    name: remoteAgent.name,
                    provider: 'ASSISTAI',
                    model: remoteAgent.model || 'gpt-4',
                    description: remoteAgent.description,
                    isEnabled: true,
                    config: { assistaiCode: remoteAgent.code }
                }
            });
            console.log(`  ✅ ${remoteAgent.name} (synced)`);
        }
    }

    console.log('\n✨ Sync complete!\n');

    // Show agents
    const agents = await prisma.aiAgent.findMany({
        where: { organizationId: orgId, provider: 'ASSISTAI' }
    });

    console.log(`📊 Total ${agents.length} AssistAI agents in database:`);
    agents.forEach(a => {
        const code = (a.config as any)?.assistaiCode;
        console.log(`   - ${a.name} (code: ${code})`);
    });

    await prisma.$disconnect();
}

syncAgents();
