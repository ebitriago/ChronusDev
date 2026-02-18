
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const users = await prisma.user.findMany({
        include: { memberships: { include: { organization: true } } }
    });
    console.log('👥 ALL USERS:');
    users.forEach(u => {
        console.log(`- Name: ${u.name}, Email: ${u.email}, ID: ${u.id}`);
        u.memberships.forEach(m => console.log(`  -> Member of: ${m.organization.name} (${m.organization.id})`));
    });
}

main();
