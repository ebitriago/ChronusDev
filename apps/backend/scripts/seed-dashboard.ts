
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
    datasourceUrl: 'postgresql://postgres:postgres@localhost:5434/chronuscrm?schema=chronusdev'
});

async function main() {
    console.log('🌱 Restoring Dashboard Data for admin@chronus.com...');

    // 1. Get the existing Demo Organization
    const org = await prisma.organization.findUnique({
        where: { slug: 'demo-org' }
    });

    if (!org) {
        console.error('❌ Demo Organization not found! Run seed.ts first.');
        process.exit(1);
    }
    console.log(`🏢 Organization found: ${org.name} [${org.id}]`);

    // 2. Get the Admin User
    const user = await prisma.user.findUnique({
        where: { email: 'admin@chronus.com' }
    });

    if (!user) {
        console.error('❌ User admin@chronus.com not found!');
        process.exit(1);
    }
    console.log(`👤 User found: ${user.name} [${user.id}]`);

    // --- DATA CREATION ---

    // 3. Create Clients
    console.log('👥 Creating Clients...');
    const client1 = await prisma.client.create({
        data: {
            name: 'Tech Solutions Inc',
            email: 'contact@techsolutions.com',
            organizationId: org.id,
            status: 'ACTIVE',
            monthlyRevenue: 2500,
            plan: 'PRO'
        }
    });

    const client2 = await prisma.client.create({
        data: {
            name: 'Startup Rocket',
            email: 'hello@rocket.com',
            organizationId: org.id,
            status: 'LEAD',
            monthlyRevenue: 0,
            plan: 'BASIC'
        }
    });
    console.log('   ✅ Clients created.');

    // 4. Create Projects
    console.log('🚀 Creating Projects...');
    const project1 = await prisma.project.create({
        data: {
            name: 'Website Redesign',
            description: 'Modernize corporate website with Next.js',
            organizationId: org.id,
            clientId: client1.id,
            budget: 5000,
            status: 'ACTIVE',
            members: {
                create: {
                    userId: user.id,
                    role: 'ADMIN',
                    payRate: 0,
                    billRate: 100
                }
            }
        }
    });

    const project2 = await prisma.project.create({
        data: {
            name: 'Mobile App MVP',
            description: 'Flutter app for iOS and Android',
            organizationId: org.id,
            clientId: client2.id,
            budget: 15000,
            status: 'PLANNING',
            members: {
                create: {
                    userId: user.id,
                    role: 'ADMIN',
                    payRate: 0,
                    billRate: 120
                }
            }
        }
    });
    console.log('   ✅ Projects created.');

    // 5. Create Tasks
    console.log('📋 Creating Tasks...');
    await prisma.task.createMany({
        data: [
            {
                projectId: project1.id,
                title: 'Design Mockups',
                description: 'Create Figma designs for homepage',
                status: 'DONE',
                priority: 'HIGH',
                createdById: user.id,
                assignedToId: user.id,
                estimatedHours: 8
            },
            {
                projectId: project1.id,
                title: 'Implement Authentication',
                description: 'Setup NextAuth.js',
                status: 'IN_PROGRESS',
                priority: 'URGENT',
                createdById: user.id,
                assignedToId: user.id,
                estimatedHours: 12
            },
            {
                projectId: project2.id,
                title: 'Setup CI/CD',
                description: 'Configure GitHub Actions',
                status: 'TODO',
                priority: 'MEDIUM',
                createdById: user.id,
                assignedToId: user.id,
                estimatedHours: 4
            }
        ]
    });
    console.log('   ✅ Tasks created.');

    // 6. Create Financials (Invoices, Orders, Tickets) for Dashboard Stats
    console.log('💰 Creating Financial Data...');

    // Invoice
    await prisma.invoice.create({
        data: {
            organizationId: org.id,
            clientId: client1.id,
            amount: 2500,
            status: 'PAID',
            currency: 'USD',
            dueDate: new Date()
        }
    });

    // Ticket
    await prisma.ticket.create({
        data: {
            organizationId: org.id,
            clientId: client1.id,
            title: 'API Integration Issue',
            priority: 'HIGH',
            status: 'OPEN',
            description: '500 Error on /api/v1/users'
        }
    });

    await prisma.ticket.create({
        data: {
            organizationId: org.id,
            clientId: client2.id,
            title: 'Feature Request: Dark Mode',
            priority: 'LOW',
            status: 'OPEN',
            description: 'User wants dark mode support'
        }
    });

    // Order
    await prisma.order.create({
        data: {
            organizationId: org.id,
            clientId: client1.id,
            orderNumber: 'ORD-2024-001',
            amount: 120,
            status: 'PENDING',
            currency: 'USD'
        }
    });

    console.log('   ✅ Financial data created.');
    console.log('\n✨ Dashboard restoration complete!');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
