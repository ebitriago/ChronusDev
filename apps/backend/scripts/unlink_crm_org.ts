
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const targetCrmOrgId = 'cmlfhy7yc0004sathmv36wae5';
    console.log(`🛠️ Attempting to UNLINK CRM Org ID: ${targetCrmOrgId}`);

    try {
        await prisma.$connect();

        // Find existing links
        const orgs = await prisma.organization.findMany({
            where: { crmOrganizationId: targetCrmOrgId }
        });

        if (orgs.length === 0) {
            console.log('✅ No organizations found linking to this CRM ID.');
            return;
        }

        console.log(`⚠️ Found ${orgs.length} organization(s) linked. Unlinking now...`);

        // Unlink
        const result = await prisma.organization.updateMany({
            where: { crmOrganizationId: targetCrmOrgId },
            data: { crmOrganizationId: null }
        });

        console.log(`✅ Successfully unlinked ${result.count} organization(s).`);
        console.log('You can now try linking again from the UI.');

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
