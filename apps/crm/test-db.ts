import { prisma } from './src/db.js';

async function main() {
    try {
        const userCount = await prisma.user.count();
        console.log('User count:', userCount);
        const firstUser = await prisma.user.findFirst();
        console.log('First user email:', firstUser?.email);
    } catch (e) {
        console.error('Error querying DB:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
