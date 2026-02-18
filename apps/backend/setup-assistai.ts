// Quick script to create AssistAI integration
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const orgId = 'cml307egh000301pd2qvjtaga'; // Org de Admin Chronus
    const apiToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6ImFzc2lzdGFpLmxhdEBnbWFpbC5jb20iLCJzdWIiOjU0LCJkYXRhIjp7InVzZXIiOnsiaWQiOjU0LCJlbWFpbCI6ImFzc2lzdGFpLmxhdEBnbWFpbC5jb20iLCJmaXJzdG5hbWUiOiJBc3Npc3RhaSIsImxhc3RuYW1lIjoiTWFya2V0aW5nIHkgc29wb3J0ZSIsInBob3RvVXJsIjoiaHR0cHM6Ly9tdWx0aW1lZGlhLmFzc2lzdGFpLmxhdC91cGxvYWRzL2Q5NGM0ZjJiNWYyNjQwNDBhMGJhMGMxYmVkY2Y5NzkzIiwicGhvbmVOdW1iZXIiOm51bGwsImNhbkNyZWF0ZU9yZ2FuaXphdGlvbnMiOnRydWV9fSwiaWF0IjoxNzcwNDk5OTA3LCJleHAiOjE4MDIwMzU5MDd9.PbyPMWi_vKhJBlPdEokXOFVhCK3nzDn-4tK_QSrjweo';

    console.log('Creating/Updating AssistAI integration...');

    // Check if exists
    const existing = await prisma.integration.findFirst({
        where: {
            organizationId: orgId,
            provider: 'ASSISTAI'
        }
    });

    if (existing) {
        await prisma.integration.update({
            where: { id: existing.id },
            data: {
                credentials: {
                    apiToken,
                    tenantDomain: 'ce230715ba86721e',
                    organizationCode: 'd59b32edfb28e130',
                    baseUrl: 'https://public.assistai.lat'
                },
                isEnabled: true
            }
        });
        console.log('✅ Updated existing integration');
    } else {
        await prisma.integration.create({
            data: {
                organizationId: orgId,
                provider: 'ASSISTAI',
                credentials: {
                    apiToken,
                    tenantDomain: 'ce230715ba86721e',
                    organizationCode: 'd59b32edfb28e130',
                    baseUrl: 'https://public.assistai.lat'
                },
                isEnabled: true
            }
        });
        console.log('✅ Created new integration');
    }

    // Test connection
    console.log('\n🔍 Testing API connection...');
    const headers = {
        'Authorization': `Bearer ${apiToken}`,
        'x-tenant-domain': 'ce230715ba86721e',
        'x-organization-code': 'd59b32edfb28e130',
        'Content-Type': 'application/json',
    };

    try {
        const response = await fetch('https://public.assistai.lat/api/v1/agents', { headers });
        if (!response.ok) {
            const error = await response.text();
            console.error(`❌ API Error ${response.status}: ${error}`);
        } else {
            const data = await response.json();
            console.log(`✅ API works! Found ${data.data?.length || 0} agents:`);
            data.data?.forEach((a: any) => console.log(`   - ${a.name} (${a.code})`));
        }
    } catch (err: any) {
        console.error('❌ Connection failed:', err.message);
    }

    await prisma.$disconnect();
}

main();
