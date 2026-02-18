import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
    datasourceUrl: 'postgresql://postgres:postgres@127.0.0.1:5434/chronuscrm?schema=public'
});

async function testAssistAISync() {
    try {
        console.log('🔍 Step 1: Finding organization...');

        // List all organizations
        const allOrgs = await prisma.organization.findMany({
            select: {
                id: true,
                name: true
            }
        });

        console.log('Available organizations:');
        allOrgs.forEach(o => console.log(`  - ${o.name} (${o.id})`));

        const org = allOrgs.find(o =>
            o.name.toLowerCase().includes('admin') ||
            o.name.toLowerCase().includes('chronus')
        );

        if (!org) {
            console.error('❌ Organization not found');
            return;
        }

        console.log(`\n✅ Using organization: ${org.name} (ID: ${org.id})`);

        console.log('\n🔍 Step 2: Checking AssistAI integration...');
        const integration = await prisma.integration.findFirst({
            where: {
                organizationId: org.id,
                provider: 'ASSISTAI'
            }
        });

        if (!integration) {
            console.error('❌ AssistAI integration not found');
            console.log('Available integrations for this org:');
            const allIntegrations = await prisma.integration.findMany({
                where: { organizationId: org.id },
                select: {
                    name: true,
                    provider: true,
                    isEnabled: true
                }
            });
            console.table(allIntegrations);
            return;
        }

        console.log(`✅ Integration found: ${integration.name}`);
        console.log(`   Enabled: ${integration.isEnabled}`);
        console.log('   Credentials:', JSON.stringify(integration.credentials, null, 2));

        if (!integration.isEnabled) {
            console.warn('⚠️  Integration is DISABLED. Enabling it now...');
            await prisma.integration.update({
                where: { id: integration.id },
                data: { isEnabled: true }
            });
            console.log('✅ Integration enabled!');
        }

        // Test the API connection
        console.log('\n🔍 Step 3: Testing connection to AssistAI API...');
        const creds = integration.credentials as any;

        if (!creds.apiToken || !creds.tenantDomain || !creds.organizationCode) {
            console.error('❌ Missing required credentials!');
            console.log('Current credentials:', creds);
            return;
        }

        const headers = {
            'Authorization': `Bearer ${creds.apiToken}`,
            'x-tenant-domain': creds.tenantDomain,
            'x-organization-code': creds.organizationCode,
            'Content-Type': 'application/json',
        };

        const baseUrl = creds.baseUrl || 'https://public.assistai.lat';
        console.log(`Calling: ${baseUrl}/api/v1/agents`);
        console.log('Headers:', {
            'x-tenant-domain': creds.tenantDomain,
            'x-organization-code': creds.organizationCode,
            'Authorization': `Bearer ${creds.apiToken.substring(0, 10)}...`
        });

        const response = await fetch(`${baseUrl}/api/v1/agents`, { headers });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`❌ API Error ${response.status}:`);
            console.error(errorText);
            return;
        }

        const data = await response.json();
        console.log(`✅ API connected successfully`);
        console.log(`Found ${data.data?.length || 0} agents:`);

        if (data.data && data.data.length > 0) {
            data.data.forEach((agent: any, idx: number) => {
                console.log(`  ${idx + 1}. ${agent.name} (${agent.code})`);
                console.log(`     Model: ${agent.model}`);
                console.log(`     Description: ${agent.description || 'N/A'}`);
            });

            // Sync to database
            console.log('\n🔍 Step 4: Syncing agents to database...');
            let syncedCount = 0;

            for (const remoteAgent of data.data) {
                try {
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
                } catch (err: any) {
                    console.error(`  ❌ Error syncing ${remoteAgent.name}:`, err.message);
                }
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
        } else {
            console.log('⚠️  No agents found in AssistAI');
        }

    } catch (error: any) {
        console.error('❌ Error:', error.message);
        if (error.stack) console.error(error.stack);
    } finally {
        await prisma.$disconnect();
    }
}

testAssistAISync();
