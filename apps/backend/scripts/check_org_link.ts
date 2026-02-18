
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const targetCrmOrgId = 'cmlfhy7yc0004sathmv36wae5';
    console.log(`🔍 Searching for CRM Org ID: ${targetCrmOrgId}`);

    try {
        await prisma.$connect();

        // Find if any organization has this crmOrganizationId
        const orgs = await prisma.organization.findMany({
            where: {
                crmOrganizationId: targetCrmOrgId
            }
        });

        if (orgs.length > 0) {
            console.log('⚠️ FOUND! The CRM Organization is linked to the following ChronusDev Organization(s):');
            console.table(orgs.map(o => ({
                id: o.id,
                name: o.name,
                crmOrganizationId: o.crmOrganizationId
            })));
        } else {
            console.log('✅ No conflict found. This CRM Organization ID is not currently linked.');
        }

        // Also list current org for context
        const currentOrgId = 'cmlfllbed0002phmdvi41qi4r';
        const currentOrg = await prisma.organization.findUnique({
            where: { id: currentOrgId }
        });
        console.log('\nCurrent User Organization (from screenshot):');
        console.log(currentOrg);

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
