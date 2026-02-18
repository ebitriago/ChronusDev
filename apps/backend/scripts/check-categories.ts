
import { prisma } from '../src/db';

async function main() {
    try {
        const categories = await prisma.transaction.groupBy({
            by: ['category', 'type'],
            _count: {
                category: true
            }
        });
        console.log('Existing Categories in DB:');
        console.table(categories);
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
