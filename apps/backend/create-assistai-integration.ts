import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
    datasourceUrl: 'postgresql://postgres:postgres@127.0.0.1:5434/chronuscrm?schema=public'
});

async function createAssistAIIntegration() {
    try {
        // Find the Admin Chronus org
        const org = await prisma.organization.findFirst({
            where: {
                name: { contains: 'Admin Chronus' }
            }
        });

        if (!org) {
            console.error('❌ Organization "Admin Chronus" not found');
            return;
        }

        console.log(`✅ Found organization: ${org.name} (ID: ${org.id})`);

        // Check if integration already exists
        const existing = await prisma.integration.findFirst({
            where: {
                organizationId: org.id,
                provider: 'ASSISTAI'
            }
        });

        if (existing) {
            console.log('⚠️  Integration already exists. Updating...');
            await prisma.integration.update({
                where: { id: existing.id },
                data: {
                    credentials: {
                        apiToken: process.env.ASSISTAI_TOKEN || 'YOUR_API_TOKEN_HERE',
                        tenantDomain: 'ce230715ba86721e',
                        organizationCode: 'd59b32edfb28e130',
                        baseUrl: 'https://public.assistai.lat'
                    },
                    isEnabled: true
                }
            });
            console.log('✅ Integration updated!');
        } else {
            console.log('Creating new AssistAI integration...');
            await prisma.integration.create({
                data: {
                    organizationId: org.id,
                    provider: 'ASSISTAI',
                    credentials: {
                        apiToken: process.env.ASSISTAI_TOKEN || 'YOUR_API_TOKEN_HERE',
                        tenantDomain: 'ce230715ba86721e',
                        organizationCode: 'd59b32edfb28e130',
                        baseUrl: 'https://public.assistai.lat'
                    },
                    isEnabled: true
                }
            });
            console.log('✅ Integration created!');
        }

        // Verify
        const integration = await prisma.integration.findFirst({
            where: {
                organizationId: org.id,
                provider: 'ASSISTAI'
            }
        });

        console.log('\n📋 Current Integration:');
        console.log('   Provider:', integration?.provider);
        console.log('   Enabled:', integration?.isEnabled);
        console.log('   Credentials:', JSON.stringify(integration?.credentials, null, 2));

    } catch (error: any) {
        console.error('❌ Error:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

createAssistAIIntegration();
