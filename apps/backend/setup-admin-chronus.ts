import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function setup() {
    console.log('🔧 Setting up admin@chronus.com with AssistAI integration...\n');
    
    // 1. Find or create admin@chronus.com user
    let adminUser = await prisma.user.findUnique({
        where: { email: 'admin@chronus.com' }
    });
    
    if (!adminUser) {
        console.log('Creating admin@chronus.com user...');
        adminUser = await prisma.user.create({
            data: {
                email: 'admin@chronus.com',
                name: 'Admin Chronus',
                password: '$2b$10$YourHashedPasswordHere', // You should hash this properly
                role: 'ADMIN'
            }
        });
        console.log('✓ User created');
    } else {
        console.log(`✓ User found: ${adminUser.name}`);
    }
    
    // 2. Find or use El Sabor organization (the one with AssistAI integration)
    const orgId = 'cml307egh000301pd2qvjtaga';
    const org = await prisma.organization.findUnique({
        where: { id: orgId }
    });
    
    if (!org) {
        console.log('❌ Organization not found');
        return;
    }
    
    console.log(`✓ Using organization: ${org.name} (${org.id})\n`);
    
    // 3. Check if user is already a member
    const existingMember = await prisma.organizationMember.findFirst({
        where: {
            userId: adminUser.id,
            organizationId: orgId
        }
    });
    
    if (existingMember) {
        console.log('✓ User is already a member of this organization');
    } else {
        console.log('Adding user as organization member...');
        await prisma.organizationMember.create({
            data: {
                userId: adminUser.id,
                organizationId: orgId,
                role: 'ADMIN'
            }
        });
        console.log('✓ Membership created');
    }
    
    // 4. Verify AssistAI integration exists
    const integration = await prisma.integration.findFirst({
        where: {
            organizationId: orgId,
            provider: 'ASSISTAI'
        }
    });
    
    if (integration) {
        console.log('\n✅ AssistAI integration is ready!');
        const creds = integration.credentials as any;
        console.log(`   Tenant: ${creds.tenantDomain}`);
        console.log(`   Org Code: ${creds.organizationCode}`);
        console.log(`   Enabled: ${integration.isEnabled}`);
    } else {
        console.log('\n❌ No AssistAI integration found for this organization');
    }
    
    console.log('\n📋 Summary:');
    console.log(`   User: ${adminUser.email}`);
    console.log(`   Organization: ${org.name}`);
    console.log(`   Can sync AssistAI: ${integration ? 'YES' : 'NO'}`);
    
    await prisma.$disconnect();
}

setup();
