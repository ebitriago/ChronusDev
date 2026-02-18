// Seed script for ChronusDev
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Seeding ChronusDev database...');

    // Crear organización de ejemplo
    const org = await prisma.organization.upsert({
        where: { slug: 'demo-org' },
        update: {},
        create: {
            name: 'Demo Organization',
            slug: 'demo-org',
            enabledServices: 'CHRONUSDEV',
            subscriptionStatus: 'ACTIVE'
        }
    });

    // Common password for all demo users
    const demoPassword = await bcrypt.hash('demo123', 10);

    // 1. Super Admin
    await prisma.user.upsert({
        where: { email: 'super@chronusdev.com' },
        update: { password: demoPassword, role: 'SUPER_ADMIN' },
        create: {
            email: 'super@chronusdev.com',
            name: 'Super Admin',
            password: demoPassword,
            role: 'SUPER_ADMIN',
            // Super admin needs to be in the org to see it in some views
            memberships: {
                create: {
                    organizationId: org.id,
                    role: 'ADMIN',
                    defaultPayRate: 0
                }
            }
        }
    });

    // 2. Admin Org (admin@chronusdev.com)
    await prisma.user.upsert({
        where: { email: 'admin@chronusdev.com' },
        update: { password: demoPassword, role: 'ADMIN' },
        create: {
            email: 'admin@chronusdev.com',
            name: 'Admin User',
            password: demoPassword,
            role: 'ADMIN',
            memberships: {
                create: {
                    organizationId: org.id,
                    role: 'ADMIN',
                    defaultPayRate: 0
                }
            }
        }
    });

    // 3. Dev (juan@chronusdev.com)
    await prisma.user.upsert({
        where: { email: 'juan@chronusdev.com' },
        update: { password: demoPassword, role: 'DEV' },
        create: {
            email: 'juan@chronusdev.com',
            name: 'Juan Dev',
            password: demoPassword,
            role: 'DEV',
            memberships: {
                create: {
                    organizationId: org.id,
                    role: 'DEV',
                    defaultPayRate: 25
                }
            }
        }
    });

    // 4. Legacy Admin (admin@chronus.com)
    await prisma.user.upsert({
        where: { email: 'admin@chronus.com' },
        update: { password: demoPassword },
        create: {
            email: 'admin@chronus.com',
            name: 'Legacy Admin',
            password: demoPassword,
            role: 'ADMIN',
            memberships: {
                create: {
                    organizationId: org.id,
                    role: 'ADMIN',
                    defaultPayRate: 0
                }
            }
        }
    });

    // 5. Legacy Dev (dev@chronus.com)
    await prisma.user.upsert({
        where: { email: 'dev@chronus.com' },
        update: { password: demoPassword },
        create: {
            email: 'dev@chronus.com',
            name: 'Legacy Dev',
            password: demoPassword,
            role: 'DEV',
            memberships: {
                create: {
                    organizationId: org.id,
                    role: 'DEV',
                    defaultPayRate: 25
                }
            }
        }
    });

    console.log('✅ Seed completed!');
    console.log('ForAll users password is: demo123');
    console.log('- super@chronusdev.com');
    console.log('- admin@chronusdev.com');
    console.log('- juan@chronusdev.com');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
