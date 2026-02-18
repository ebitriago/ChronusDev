
import { PrismaClient } from '@prisma/client';

async function main() {
    const prisma = new PrismaClient();
    try {
        const users = await prisma.user.findMany({
            select: { id: true, email: true, name: true, role: true, memberships: { include: { organization: true } } }
        });
        console.log('Users found:', users.length);
        users.forEach(u => {
            console.log(`- ${u.email} (${u.role}) - Org: ${u.memberships[0]?.organization?.name || 'None'}`);
        });

        const orgs = await prisma.organization.findMany();
        console.log('\nOrganizations found:', orgs.length);
        orgs.forEach(o => {
            console.log(`- ${o.name} (${o.slug})`);
        });

    } catch (error) {
        console.error(error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
