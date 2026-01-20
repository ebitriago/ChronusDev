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

    // Create admin user
    const hashedPassword = await bcrypt.hash('admin123', 10);
    const admin = await prisma.user.upsert({
        where: { email: 'admin@chronuscrm.com' },
        update: {},
        create: {
            email: 'admin@chronuscrm.com',
            password: hashedPassword,
            name: 'Admin User',
            role: Role.ADMIN,
        },
    });
    console.log('✅ Created admin user:', admin.email);

    // Create agent user
    const agent = await prisma.user.upsert({
        where: { email: 'agent@chronuscrm.com' },
        update: {},
        create: {
            email: 'agent@chronuscrm.com',
            password: await bcrypt.hash('agent123', 10),
            name: 'Support Agent',
            role: Role.AGENT,
        },
    });
    console.log('✅ Created agent user:', agent.email);

    // Create sample customers
    const customers = [
        { name: 'TechCorp Solutions', email: 'contact@techcorp.com', company: 'TechCorp', plan: Plan.PRO, status: CustomerStatus.ACTIVE, monthlyRevenue: 299 },
        { name: 'Digital Agency', email: 'hello@digitalagency.com', company: 'Digital Agency', plan: Plan.ENTERPRISE, status: CustomerStatus.ACTIVE, monthlyRevenue: 599 },
        { name: 'StartupX', email: 'info@startupx.io', company: 'StartupX', plan: Plan.BASIC, status: CustomerStatus.TRIAL, monthlyRevenue: 49 },
        { name: 'Maria Rodriguez', email: 'maria@ejemplo.com', company: 'Freelancer', plan: Plan.FREE, status: CustomerStatus.ACTIVE, monthlyRevenue: 0 },
    ];

    for (const c of customers) {
        await prisma.customer.upsert({
            where: { email: c.email },
            update: {},
            create: c,
        });
    }
    console.log('✅ Created', customers.length, 'customers');

    // Create sample leads
    const leads = [
        { name: 'Carlos Mendez', email: 'carlos@prospect.com', company: 'Prospect Inc', value: 5000, status: LeadStatus.NEW, source: LeadSource.ORGANIC },
        { name: 'Ana Torres', email: 'ana@potential.com', company: 'Potential Corp', value: 12000, status: LeadStatus.QUALIFIED, source: LeadSource.REFERRAL },
        { name: 'Luis Vargas', email: 'luis@bigclient.com', company: 'Big Client', value: 25000, status: LeadStatus.PROPOSAL, source: LeadSource.PAID },
    ];

    for (const l of leads) {
        const existingLead = await prisma.lead.findFirst({ where: { email: l.email } });
        if (!existingLead) {
            await prisma.lead.create({ data: l });
        }
    }
    console.log('✅ Created', leads.length, 'leads');

    // Create sample tags
    const tags = [
        { name: 'VIP', color: '#EAB308' },
        { name: 'Premium', color: '#8B5CF6' },
        { name: 'At Risk', color: '#EF4444' },
        { name: 'Enterprise', color: '#3B82F6' },
    ];

    for (const t of tags) {
        await prisma.tag.upsert({
            where: { name: t.name },
            update: {},
            create: t,
        });
    }
    console.log('✅ Created', tags.length, 'tags');

    // Get first customer for tickets
    const firstCustomer = await prisma.customer.findFirst();
    if (firstCustomer) {
        // Check if tickets exist
        const ticketCount = await prisma.ticket.count();
        if (ticketCount === 0) {
            const tickets = [
                { title: 'Login issue', description: 'Cannot login to the platform', priority: Priority.HIGH, status: TicketStatus.OPEN, customerId: firstCustomer.id, assignedToId: agent.id },
                { title: 'Billing question', description: 'Need clarification on invoice', priority: Priority.MEDIUM, status: TicketStatus.IN_PROGRESS, customerId: firstCustomer.id, assignedToId: agent.id },
            ];

            for (const t of tickets) {
                await prisma.ticket.create({ data: t });
            }
            console.log('✅ Created', tickets.length, 'tickets');
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
