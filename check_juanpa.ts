
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
    datasourceUrl: 'postgresql://postgres:postgres@localhost:5434/chronuscrm?schema=chronusdev'
});

async function main() {
    console.log('🔍 Searching for "juanpa"...');

    // 1. Search User table
    const users = await prisma.user.findMany({
        where: {
            OR: [
                { name: { contains: 'juan', mode: 'insensitive' } },
                { email: { contains: 'juan', mode: 'insensitive' } }
            ]
        },
        include: {
            memberships: {
                include: { organization: true }
            }
        }
    });

    console.log(`FOUND: ${users.length} users matching "juan"`);
    users.forEach(u => {
        console.log(`- ${u.name} (<${u.email}>) ID: ${u.id}`);
        if (u.memberships.length === 0) {
            console.log('  ⚠️ NO MEMBERSHIPS (Orphaned)');
        } else {
            console.log('  Memberships:');
            u.memberships.forEach(m => console.log(`    * ${m.organization.name} [${m.role}]`));
        }
    });

    // 2. Check Demo Org Members
    const demoOrg = await prisma.organization.findUnique({
        where: { slug: 'demo-org' },
        include: { members: { include: { user: true } } }
    });

    if (demoOrg) {
        console.log(`\n🏢 Organization "${demoOrg.name}" Members:`);
        demoOrg.members.forEach(m => {
            console.log(`- ${m.user.name} (${m.role})`);
        });
    }
}

main()
    .catch(console.error)
    .finally(async () => {
        await prisma.$disconnect();
    });
