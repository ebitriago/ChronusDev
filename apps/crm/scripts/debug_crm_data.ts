
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
    log: ['query', 'error']
});

async function main() {
    console.log('🔍 Debugging CRM Data...');
    console.log('DB URL:', process.env.DATABASE_URL?.replace(/:[^:@]*@/, ':****@'));

    try {
        // 1. Check Connection
        await prisma.$connect();
        console.log('✅ Connected to DB');

        // 2. Count Organizations
        const orgCount = await prisma.organization.count();
        console.log(`🏢 Organizations found: ${orgCount}`);

        // 3. List Organizations
        const orgs = await prisma.organization.findMany({
            take: 5,
            include: { _count: { select: { customers: true } } }
        });
        console.table(orgs.map(o => ({
            id: o.id,
            name: o.name,
            customers: o._count.customers
        })));

        // 4. Count Customers
        const customerCount = await prisma.customer.count();
        console.log(`👥 Customers found (Total): ${customerCount}`);

        // 5. Get first 5 customers
        const customers = await prisma.customer.findMany({ take: 5 });
        console.log('First 5 customers:', customers);

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
