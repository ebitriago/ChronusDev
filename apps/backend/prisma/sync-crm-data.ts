
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🔄 Syncing CRM Data (Orgs & Clients) to ChronusDev...');

    // 1. Fetch CRM Data using Raw SQL (Assuming CRM is in 'public' schema)
    // We target the specific Organization found: cml307egh000301pd2qvjtaga
    const targetOrgId = 'cml307egh000301pd2qvjtaga';

    console.log(`📡 Fetching data for Org ID: ${targetOrgId}`);

    const crmOrgs: any[] = await prisma.$queryRawUnsafe(`
        SELECT id, name, slug, "enabledServices", "subscriptionStatus" 
        FROM public."Organization" 
        WHERE id = '${targetOrgId}'
    `);

    const crmClients: any[] = await prisma.$queryRawUnsafe(`
        SELECT id, name, email, phone, "organizationId"
        FROM public."Customer"
        WHERE "organizationId" = '${targetOrgId}'
    `);

    const crmUsers: any[] = await prisma.$queryRawUnsafe(`
        SELECT u.id, u.email, u.name, u.role, om."role" as "orgRole"
        FROM public."User" u
        JOIN public."OrganizationMember" om ON u.id = om."userId"
        WHERE om."organizationId" = '${targetOrgId}'
    `);

    console.log(`Found: ${crmOrgs.length} Orgs, ${crmClients.length} Clients, ${crmUsers.length} Users.`);

    // 2. Sync Organization
    for (const org of crmOrgs) {
        console.log(`Syncing Org: ${org.name}`);
        await prisma.organization.upsert({
            where: { id: org.id },
            update: {
                name: org.name,
                slug: org.slug,
                enabledServices: org.enabledServices, // Might need adjustment if string formats differ
                subscriptionStatus: org.subscriptionStatus
            },
            create: {
                id: org.id,
                name: org.name,
                slug: org.slug,
                enabledServices: org.enabledServices || 'CHRONUSDEV',
                subscriptionStatus: org.subscriptionStatus || 'ACTIVE'
            }
        });
    }

    // 3. Sync Clients
    for (const client of crmClients) {
        console.log(`Syncing Client: ${client.name}`);
        await prisma.client.upsert({
            where: { id: client.id },
            update: {
                name: client.name,
                email: client.email,
                phone: client.phone,
                organizationId: client.organizationId
            },
            create: {
                id: client.id,
                name: client.name,
                email: client.email || '',
                phone: client.phone,
                organizationId: client.organizationId
            }
        });
    }

    // 4. Sync Users & Memberships
    for (const user of crmUsers) {
        console.log(`Syncing User Membership: ${user.email}`);

        // Ensure user exists (might be created by previous sync, but update CRM ID)
        await prisma.user.upsert({
            where: { email: user.email },
            update: { crmUserId: user.id },
            create: {
                id: user.id, // Try to keep ID same if possible, else let it gen new or use email map
                email: user.email,
                name: user.name,
                role: user.role === 'AGENT' ? 'DEV' : user.role, // Map role
                crmUserId: user.id
            }
        });

        // Link to Org
        const localUser = await prisma.user.findUnique({ where: { email: user.email } });
        if (localUser) {
            await prisma.organizationMember.upsert({
                where: {
                    userId_organizationId: {
                        userId: localUser.id,
                        organizationId: targetOrgId
                    }
                },
                update: {
                    role: user.orgRole === 'AGENT' ? 'DEV' : user.orgRole
                },
                create: {
                    userId: localUser.id,
                    organizationId: targetOrgId,
                    role: user.orgRole === 'AGENT' ? 'DEV' : user.orgRole
                }
            });
        }
    }

    console.log('✅ Sync completed successfully!');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
