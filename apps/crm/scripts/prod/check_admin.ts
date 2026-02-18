
import { PrismaClient } from '@prisma/client';

async function main() {
    const prisma = new PrismaClient();
    try {
        const admin = await prisma.user.findFirst({
            where: { email: 'admin@chronus.com' },
            include: { memberships: { include: { organization: true } } }
        });
        console.log('Admin User:', admin ? 'Found' : 'Not Found');
        if (admin) {
            console.log('Admin Org:', admin.memberships[0]?.organization?.name);
        }
    } catch (error) {
        console.error(error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
