
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const usersToSync = [
    { email: 'admin@chronuscrm.com', name: 'Admin User', role: 'ADMIN', crmUserId: 'cml1ns3fv00019i119mttyrwb' },
    { email: 'superadmin@chronuscrm.com', name: 'Super Admin', role: 'SUPER_ADMIN', crmUserId: 'cml5yoifb000411u0ru2e8mg2' },
    { email: 'agent@chronuscrm.com', name: 'Support Agent', role: 'DEV', crmUserId: 'cml5yoife000711u0t43vo25p' }, // Map AGENT -> DEV
    { email: 'admin@chronus.com', name: 'Admin Chronus', role: 'ADMIN', crmUserId: 'cml307egf000201pdo3y0ylc8' },
    { email: 'admin@chronusdev.com', name: 'Admin User', role: 'ADMIN' }, // Existing seed
    { email: 'dev@chronusdev.com', name: 'Dev User', role: 'DEV' } // Existing seed
];

async function main() {
    console.log('🔄 Syncing CRM Users to ChronusDev...');

    // Ensure Org exists
    const org = await prisma.organization.upsert({
        where: { slug: 'demo-org' },
        update: {},
        create: {
            name: 'Chronus Organization',
            slug: 'demo-org',
            enabledServices: 'CHRONUSDEV',
            subscriptionStatus: 'ACTIVE'
        }
    });

    for (const u of usersToSync) {
        console.log(`Processing ${u.email}...`);

        // Upsert User
        const user = await prisma.user.upsert({
            where: { email: u.email },
            update: {
                crmUserId: u.crmUserId
            },
            create: {
                email: u.email,
                name: u.name,
                role: u.role as any,
                crmUserId: u.crmUserId,
                // No password needed as they use SSO token, but setting dummy if needed? 
                // Schema allows password null? Yes.
            }
        });

        // Upsert Membership
        await prisma.organizationMember.upsert({
            where: {
                userId_organizationId: {
                    userId: user.id,
                    organizationId: org.id
                }
            },
            update: {
                role: u.role as any
            },
            create: {
                userId: user.id,
                organizationId: org.id,
                role: u.role as any
            }
        });
    }

    console.log('✅ Sync completed!');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
