import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
    datasourceUrl: 'postgresql://postgres:postgres@127.0.0.1:5434/chronuscrm?schema=public'
});

async function testAssistAISync() {
    try {
        console.log('🔍 Step 1: Finding organization "Org de Admin Chronus"...');
        const org = await prisma.organization.findFirst({
            where: {
                OR: [
                    { name: { contains: 'Admin', mode: 'insensitive' } },
                    { name: { contains: 'Chronus', mode: 'insensitive' } }
                ]
            }
        });

        if (!org) {
            console.error('❌ Organization not found');
            return;
        }

        console.log(`✅ Found organization: ${org.name} (ID: ${org.id})`);

        console.log('\n🔍 Step 2: Checking AssistAI integration...');
        const integration = await prisma.integration.findFirst({
            where: {
                organizationId: org.id,
                provider: 'ASSISTAI',
                isEnabled: true
            }
        });

        if (!integration) {
            console.error('❌ AssistAI integration not found or not enabled');
            console.log('Available integrations for this org:');
            const allIntegrations = await prisma.integration.findMany({
                where: { organizationId: org.id }
            });
            console.table(allIntegrations.map(i => ({
                name: i.name,
                provider: i.provider,
                enabled: i.isEnabled
            })));
            return;
        }

        console.log(`✅ Integration found: ${integration.name}`);
        console.log('Credentials:', JSON.stringify(integration.credentials, null, 2));

        // Test the API connection
        console.log('\n🔍 Step 3: Testing connection to AssistAI API...');
        const creds = integration.credentials as any;
        const headers = {
            'Authorization': `Bearer ${creds.apiToken}`,
            'x-tenant-domain': creds.tenantDomain,
            'x-organization-code': creds.organizationCode,
            'Content-Type': 'application/json',
        };

        const baseUrl = creds.baseUrl || 'https://public.assistai.lat';
        console.log(`Calling: ${baseUrl}/api/v1/agents`);

        const response = await fetch(`${baseUrl}/api/v1/agents`, { headers });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`❌ API Error ${response.status}: ${errorText}`);
            return;
        }

        const data = await response.json();
        console.log(`✅ API connected successfully`);
        console.log(`Found ${data.data?.length || 0} agents:`);

        if (data.data && data.data.length > 0) {
            data.data.forEach((agent: any, idx: number) => {
                console.log(`  ${idx + 1}. ${agent.name} (${agent.code}) - Model: ${agent.model}`);
            });
        }

        // Sync to database
        console.log('\n🔍 Step 4: Syncing agents to database...');
        let syncedCount = 0;

        for (const remoteAgent of data.data || []) {
            const existing = await prisma.aiAgent.findFirst({
                where: {
                    organizationId: org.id,
                    name: remoteAgent.name
                }
            });

            if (existing) {
                await prisma.aiAgent.update({
                    where: { id: existing.id },
                    data: {
                        model: remoteAgent.model,
                        description: remoteAgent.description,
                        config: { assistaiCode: remoteAgent.code }
                    }
                });
                console.log(`  ✏️  Updated: ${remoteAgent.name}`);
            } else {
                await prisma.aiAgent.create({
                    data: {
                        organizationId: org.id,
                        name: remoteAgent.name,
                        provider: 'ASSISTAI',
                        model: remoteAgent.model,
                        description: remoteAgent.description,
                        isEnabled: true,
                        config: { assistaiCode: remoteAgent.code }
                    }
                });
                console.log(`  ➕ Created: ${remoteAgent.name}`);
            }
            syncedCount++;
        }

        console.log(`\n✅ Sync completed! ${syncedCount} agents synced.`);

        // Show current agents
        console.log('\n📊 Current AI Agents in database:');
        const allAgents = await prisma.aiAgent.findMany({
            where: { organizationId: org.id }
        });
        console.table(allAgents.map(a => ({
            name: a.name,
            provider: a.provider,
            model: a.model,
            enabled: a.isEnabled
        })));

    } catch (error: any) {
        console.error('❌ Error:', error.message);
        console.error(error.stack);
    } finally {
        await prisma.$disconnect();
    }
}

testAssistAISync();
