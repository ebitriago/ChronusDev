import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function forceSync() {
    const orgId = 'cml307egh000301pd2qvjtaga'; // El Sabor org
    
    console.log('🚀 FORCING AssistAI sync for organization:', orgId);
    console.log('');
    
    // Get integration
    const integration = await prisma.integration.findFirst({
        where: {
            organizationId: orgId,
            provider: 'ASSISTAI'
        }
    });
    
    if (!integration) {
        console.log('❌ No integration found!');
        return;
    }
    
    const creds = integration.credentials as any;
    console.log('✓ Integration found');
    console.log(`  Tenant: ${creds.tenantDomain}`);
    console.log(`  Org Code: ${creds.organizationCode}\n`);
    
    // Fetch agents from AssistAI
    const headers = {
        'Authorization': `Bearer ${creds.apiToken}`,
        'x-tenant-domain': creds.tenantDomain,
        'x-organization-code': creds.organizationCode,
        'Content-Type': 'application/json',
    };
    
    console.log('📡 Fetching agents from AssistAI API...');
    const response = await fetch('https://public.assistai.lat/api/v1/agents', { headers });
    
    if (!response.ok) {
        console.log('❌ API error:', response.status);
        return;
    }
    
    const data = await response.json();
    console.log(`✓ Found ${data.data?.length || 0} agents from API\n`);
    
    // Delete existing agents for this org (clean slate)
    console.log('🗑️  Cleaning existing agents...');
    const deleted = await prisma.aiAgent.deleteMany({
        where: {
            organizationId: orgId,
            provider: 'ASSISTAI'
        }
    });
    console.log(`✓ Deleted ${deleted.count} old agents\n`);
    
    // Insert all agents
    console.log('💾 Inserting agents...');
    let count = 0;
    for (const agent of data.data || []) {
        await prisma.aiAgent.create({
            data: {
                organizationId: orgId,
                name: agent.name,
                provider: 'ASSISTAI',
                model: agent.model || 'gpt-4',
                description: agent.description || '',
                isEnabled: true,
                config: {
                    assistaiCode: agent.code,
                    ...agent
                }
            }
        });
        console.log(`  ✓ ${agent.name} (${agent.code})`);
        count++;
    }
    
    console.log(`\n✅ SUCCESS! Synced ${count} agents`);
    
    // Verify
    const verify = await prisma.aiAgent.findMany({
        where: {
            organizationId: orgId,
            provider: 'ASSISTAI'
        }
    });
    
    console.log(`\n📊 Verification: ${verify.length} agents in database`);
    
    await prisma.$disconnect();
}

forceSync();
