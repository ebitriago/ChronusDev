import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    try {
        const lastMessage = await prisma.message.findFirst({
            orderBy: { createdAt: 'desc' },
            include: { conversation: true }
        });
        console.log('LATEST_MESSAGE:', JSON.stringify(lastMessage, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
