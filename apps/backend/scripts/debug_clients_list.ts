
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        const clients = await prisma.client.findMany();
        console.log('Clients found:', clients);

        const users = await prisma.user.findMany();
        console.log('Users found:', users.map(u => ({ id: u.id, name: u.name, email: u.email })));

    } catch (error) {
        console.error(error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
