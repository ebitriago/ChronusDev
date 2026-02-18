import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function test() {
    const orgId = 'cml307egh000301pd2qvjtaga';
    
    console.log('🔍 Testing GET /ai-agents endpoint logic...\n');
    
    // Simulate what the endpoint does
    const agents = await prisma.aiAgent.findMany({
        where: { organizationId: orgId }
    });
    
    console.log(`Found ${agents.length} agents for org ${orgId}:`);
    agents.forEach((a, i) => {
        console.log(`${i + 1}. ${a.name} (${a.provider}) - ${a.isEnabled ? 'ENABLED' : 'DISABLED'}`);
    });
    
    console.log('\n📋 Now checking what admin@chronus.com should see...');
    
    // Check admin user's membership
    const admin = await prisma.user.findUnique({
        where: { email: 'admin@chronus.com' },
        include: {
            memberships: {
                include: {
                    organization: true
                }
            }
        }
    });
    
    if (!admin) {
        console.log('❌ User not found!');
        return;
    }
    
    console.log(`\n✓ User: ${admin.name}`);
    console.log(`  Memberships: ${admin.memberships.length}`);
    admin.memberships.forEach(m => {
        console.log(`    - ${m.organization.name} (${m.organizationId}) as ${m.role}`);
    });
    
    // The authMiddleware sets req.user.organizationId based on membership
    // Check if admin has access to the right org
    const hasAccess = admin.memberships.some(m => m.organizationId === orgId);
    console.log(`\n  Has access to agents org: ${hasAccess ? 'YES ✓' : 'NO ✗'}`);
    
    if (hasAccess) {
        console.log('\n✅ Everything is correct! User should see the agents.');
        console.log('   Problem might be in the frontend or auth token.');
    } else {
        console.log('\n❌ User does NOT have access to the organization with agents!');
    }
    
    await prisma.$disconnect();
}

test();
