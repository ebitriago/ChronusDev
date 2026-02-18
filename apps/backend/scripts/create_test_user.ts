
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    console.log('👤 Creating/Updating test user...');
    const hashedPassword = await bcrypt.hash('demo123', 10);

    const user = await prisma.user.upsert({
        where: { email: 'test@chronus.dev' },
        update: {
            password: hashedPassword,
            role: 'ADMIN' // Ensure admin role
        },
        create: {
            email: 'test@chronus.dev',
            name: 'Test Admin',
            password: hashedPassword,
            role: 'ADMIN'
        }
    });

    console.log(`✅ Test user ready: ${user.email} (${user.id})`);

    // Ensure membership in an organization if needed
    // Check if org exists
    const org = await prisma.organization.findFirst();
    if (org) {
        console.log(`Found organization: ${org.name}`);
        // Check membership
        const membership = await prisma.organizationMember.findFirst({
            where: { userId: user.id, organizationId: org.id }
        });

        if (!membership) {
            console.log('Adding membership...');
            await prisma.organizationMember.create({
                data: {
                    userId: user.id,
                    organizationId: org.id,
                    role: 'ADMIN',
                    defaultPayRate: 0
                }
            });
            console.log('✅ Membership added');
        } else {
            console.log('✅ Already a member');
        }
    } else {
        console.log('⚠️ No organization found to join');
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
