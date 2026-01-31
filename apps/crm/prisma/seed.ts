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
const prisma = new PrismaClient({ adapter }) as any;

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
        const user = await prisma.user.upsert({
            where: { email: u.email },
            update: { role: u.role },
            create: {
                email: u.email,
                name: u.name,
                password,
                role: u.role
            }
        });

        // Ensure membership exists
        await prisma.organizationMember.upsert({
            where: {
                userId_organizationId: {
                    userId: user.id,
                    organizationId: organization.id
                }
            },
            update: { role: u.role },
            create: {
                userId: user.id,
                organizationId: organization.id,
                role: u.role
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

    // 5. Create ERP Products & Orders
    console.log('🛍️ Seeding ERP data...');
    // Create Products
    const products = [
        { name: 'Laptop Pro X', description: 'High performance laptop', price: 1299.99, sku: 'LP-PRO-X', stock: 50, category: 'Electronics', imageUrl: 'https://placehold.co/600x400/2563eb/white?text=Laptop' },
        { name: 'Wireless Headphones', description: 'Noise cancelling', price: 199.99, sku: 'WH-NC-1', stock: 100, category: 'Audio', imageUrl: 'https://placehold.co/600x400/db2777/white?text=Headphones' },
        { name: 'Ergonomic Chair', description: 'Office comfort', price: 299.00, sku: 'EC-V2', stock: 20, category: 'Furniture', imageUrl: 'https://placehold.co/600x400/059669/white?text=Chair' }
    ];

    const createdProducts = [];
    for (const p of products) {
        const prod = await prisma.globalProduct.upsert({
            where: { sku: p.sku },
            update: {},
            create: {
                ...p,
                organizationId: organization.id
            }
        });
        createdProducts.push(prod);
    }
    console.log('✅ Created', createdProducts.length, 'products');

    // Create Sample Order for first customer
    const firstCustomer = await prisma.customer.findFirst({ where: { organizationId: organization.id } });
    if (firstCustomer && createdProducts.length > 0) {
        const order = await prisma.assistantShoppingCart.create({
            data: {
                customerId: firstCustomer.id,
                organizationId: organization.id,
                status: 'COMPLETED',
                total: 1499.98,
                items: {
                    create: [
                        {
                            productId: createdProducts[0].id,
                            quantity: 1,
                            unitPrice: createdProducts[0].price,
                            total: createdProducts[0].price
                        },
                        {
                            productId: createdProducts[1].id,
                            quantity: 1,
                            unitPrice: createdProducts[1].price,
                            total: createdProducts[1].price
                        }
                    ]
                }
            }
        });
        console.log('✅ Created sample order:', order.id);
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
