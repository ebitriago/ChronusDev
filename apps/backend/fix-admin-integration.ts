import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fix() {
    console.log('🔍 Finding Admin Chronus user...\n');
    
    // Find admin user
    const adminUser = await prisma.user.findFirst({
        where: { 
            OR: [
                { email: { contains: 'admin' } },
                { name: { contains: 'Admin' } }
            ]
        }
    });
    
    if (!adminUser) {
        console.log('❌ Admin user not found');
        return;
    }
    
    console.log(`✓ Found user: ${adminUser.name} (${adminUser.email})`);
    console.log(`  Organization ID: ${adminUser.organizationId}\n`);
    
    // Check if org already has integration
    const existing = await prisma.integration.findFirst({
        where: {
            organizationId: adminUser.organizationId,
            provider: 'ASSISTAI'
        }
    });
    
    if (existing) {
        console.log('✓ Integration already exists for this org!');
        console.log(`  Created: ${existing.createdAt}`);
        const creds = existing.credentials as any;
        console.log(`  Tenant: ${creds?.tenantDomain}`);
        console.log(`  Org Code: ${creds?.organizationCode}`);
    } else {
        console.log('⚠️  No integration found for this org');
        console.log('Creating new integration...\n');
        
        const created = await prisma.integration.create({
            data: {
                organizationId: adminUser.organizationId!,
                provider: 'ASSISTAI',
                isEnabled: true,
                credentials: {
                    apiToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6ImFzc2lzdGFpLmxhdEBnbWFpbC5jb20iLCJzdWIiOjU0LCJkYXRhIjp7InVzZXIiOnsiaWQiOjU0LCJlbWFpbCI6ImFzc2lzdGFpLmxhdEBnbWFpbC5jb20iLCJmaXJzdG5hbWUiOiJBc3Npc3RhaSIsImxhc3RuYW1lIjoiTWFya2V0aW5nIHkgc29wb3J0ZSIsInBob3RvVXJsIjoiaHR0cHM6Ly9tdWx0aW1lZGlhLmFzc2lzdGFpLmxhdC91cGxvYWRzL2Q5NGM0ZjJiNWYyNjQwNDBhMGJhMGMxYmVkY2Y5NzkzIiwicGhvbmVOdW1iZXIiOm51bGwsImNhbkNyZWF0ZU9yZ2FuaXphdGlvbnMiOnRydWV9fSwiaWF0IjoxNzcwNDk5OTA3LCJleHAiOjE4MDIwMzU5MDd9.PbyPMWi_vKhJBlPdEokXOFVhCK3nzDn-4tK_QSrjweo',
                    tenantDomain: 'ce230715ba86721e',
                    organizationCode: 'd59b32edfb28e130',
                    baseUrl: 'https://public.assistai.lat'
                }
            }
        });
        
        console.log('✅ Integration created!');
        console.log(`   ID: ${created.id}`);
    }
    
    await prisma.$disconnect();
}

fix();
