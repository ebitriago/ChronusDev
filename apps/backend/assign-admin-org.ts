import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fix() {
    console.log('🔍 Finding admin user and organization...\n');
    
    const adminUser = await prisma.user.findUnique({
        where: { email: 'admin@chronusdev.com' }
    });
    
    if (!adminUser) {
        console.log('❌ Admin user not found');
        return;
    }
    
    console.log(`Found: ${adminUser.name} (${adminUser.email})`);
    console.log(`Current Org ID: ${adminUser.organizationId || 'NONE'}\n`);
    
    // Use the El Sabor organization
    const targetOrgId = 'cml307egh000301pd2qvjtaga';
    
    const org = await prisma.organization.findUnique({
        where: { id: targetOrgId }
    });
    
    if (!org) {
        console.log('❌ Target organization not found');
        return;
    }
    
    console.log(`Target org: ${org.name} (${org.id})\n`);
    
    // Update user
    await prisma.user.update({
        where: { id: adminUser.id },
        data: { organizationId: targetOrgId }
    });
    
    console.log('✅ User updated successfully!');
    console.log(`   ${adminUser.name} is now part of ${org.name}`);
    
    await prisma.$disconnect();
}

fix();
