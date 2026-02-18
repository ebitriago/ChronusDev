
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log("=== DIAGNOSTIC START ===");

    // 1. List All Organizations
    const orgs = await prisma.organization.findMany();
    console.log(`\nFound ${orgs.length} Organizations:`);
    orgs.forEach(o => console.log(`- [${o.id}] ${o.name} (Slug: ${o.slug})`));

    // 2. List All Users
    const users = await prisma.user.findMany();
    console.log(`\nFound ${users.length} Users:`);
    users.forEach(u => console.log(`- [${u.id}] ${u.name} (${u.email}) Role: ${u.role}`));

    // 3. List All Memberships
    const members = await prisma.organizationMember.findMany({
        include: {
            user: true,
            organization: true
        }
    });
    console.log(`\nFound ${members.length} Memberships:`);
    members.forEach(m => console.log(`- User: ${m.user.name} (${m.user.email}) -> Org: ${m.organization.name} [${m.organization.id}] (Role: ${m.role})`));

    console.log("=== DIAGNOSTIC END ===");
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
