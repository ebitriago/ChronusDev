
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🔍 Debugging CRM Users...');

    try {
        await prisma.$connect();

        const users = await prisma.user.findMany({
            include: {
                organization: true
            }
        });

        console.table(users.map(u => ({
            id: u.id,
            name: u.name,
            email: u.email,
            orgId: u.organizationId,
            orgName: u.organization?.name || 'N/A',
            role: u.role
        })));

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
