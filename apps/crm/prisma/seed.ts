// Seed script for initial data (Prisma 7 with LibSQL)
import { PrismaClient, Role, CustomerStatus, Plan, LeadStatus, LeadSource, Priority, TicketStatus } from '@prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import bcrypt from 'bcryptjs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// SQLite file path
const dbPath = path.join(__dirname, 'dev.db');

// Prisma adapter factory
const adapter = new PrismaLibSql({ url: `file:${dbPath}` });
const prisma = new PrismaClient({ adapter });

async function main() {
    console.log('🌱 Seeding database...');

    // 1. Create Default Organization
    const organization = await prisma.organization.upsert({
        where: { slug: 'chronus' },
        update: {},
        create: {
            name: 'Chronus Tech',
            slug: 'chronus'
        }
    });
    console.log('✅ Organization:', organization.name);

    // 2. Create Users linked to Organization
    const password = await bcrypt.hash('password123', 10);

    const users = [
        { email: 'admin@chronuscrm.com', name: 'Admin User', role: Role.ADMIN },
        { email: 'superadmin@chronuscrm.com', name: 'Super Admin', role: Role.SUPER_ADMIN },
        { email: 'agent@chronuscrm.com', name: 'Support Agent', role: Role.AGENT }
    ];

    for (const u of users) {
        await prisma.user.upsert({
            where: { email: u.email },
            update: {
                role: u.role,
                memberships: {
                    connectOrCreate: {
                        where: { userId_organizationId: { userId: 'placeholder', organizationId: organization.id } }, // Logic handled by connect if exists
                        create: { organizationId: organization.id }
                    }
                }
            },
            create: {
                email: u.email,
                name: u.name,
                password,
                role: u.role,
                memberships: {
                    create: { organizationId: organization.id }
                }
            }
        });
    }
    console.log('✅ Created users');

    // Get agent for assignment
    const agent = await prisma.user.findUnique({ where: { email: 'agent@chronuscrm.com' } });

    // 3. Create Customers
    const customers = [
        { name: 'TechCorp', email: 'contact@techcorp.com', plan: Plan.PRO, status: CustomerStatus.ACTIVE },
        { name: 'StartUp', email: 'hello@startup.io', plan: Plan.BASIC, status: CustomerStatus.TRIAL }
    ];

    for (const c of customers) {
        await prisma.customer.upsert({
            where: { email: c.email },
            update: {},
            create: {
                ...c,
                organizationId: organization.id
            }
        });
    }

    // 4. Create Tickets
    if (agent) {
        const customer = await prisma.customer.findFirst({ where: { organizationId: organization.id } });
        if (customer) {
            await prisma.ticket.create({
                data: {
                    title: 'Login Issue',
                    description: 'User cannot login',
                    status: TicketStatus.OPEN,
                    priority: Priority.HIGH,
                    customerId: customer.id,
                    organizationId: organization.id,
                    assignedToId: agent.id
                }
            });
        }
    }

    console.log('🎉 Seeding complete!');
}

main()
    .catch((e) => {
        console.error('❌ Seeding error:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
