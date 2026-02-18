
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🔍 Diagnostic: CRM Data Relationships');

    try {
        await prisma.$connect();

        // 1. List All Organizations
        const orgs = await prisma.organization.findMany({
            include: {
                _count: {
                    select: { members: true, customers: true }
                }
            }
        });
        console.log('\n🏢 ORGANIZATIONS:');
        console.table(orgs.map(o => ({
            id: o.id,
            name: o.name,
            members: o._count.members,
            customers: o._count.customers
        })));

        // 2. List All Users and their Memberships
        const users = await prisma.user.findMany({
            include: {
                memberships: {
                    include: { organization: true }
                }
            }
        });
        console.log('\n👤 USERS & MEMBERSHIPS:');
        users.forEach(u => {
            console.log(`User: ${u.email} (${u.name}) - ID: ${u.id}`);
            if (u.memberships.length === 0) {
                console.log('   ⚠️  NO ORG MEMBERSHIP');
            } else {
                u.memberships.forEach(m => {
                    console.log(`   -> Member of: ${m.organization.name} (${m.organization.id}) [Role: ${m.role}]`);
                });
            }
        });

        // 3. List All Customers and their Organization
        const customers = await prisma.customer.findMany({
            include: { organization: true }
        });
        console.log('\n👥 CUSTOMERS:');
        if (customers.length === 0) {
            console.log('   ⚠️  NO CUSTOMERS FOUND IN DATABASE');
        } else {
            console.table(customers.map(c => ({
                id: c.id,
                name: c.name,
                email: c.email,
                orgId: c.organizationId,
                orgName: c.organization?.name
            })));
        }

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
