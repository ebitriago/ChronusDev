
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log("🔍 Checking Pipeline Stages...");
    const stages = await prisma.pipelineStage.findMany({
        orderBy: { order: 'asc' }
    });
    console.log("STAGES FOUND:", stages.map(s => `[${s.organizationId}] ${s.name} (default: ${s.isDefault})`));

    console.log("\n🔍 Checking Leads with status 'NEW' (Should be empty if fixed)...");
    const badLeads = await prisma.lead.findMany({
        where: { status: 'NEW' }
    });
    console.log(`Found ${badLeads.length} leads with status 'NEW'.`);

    if (badLeads.length > 0) {
        console.log("🛠 Repairing leads...");
        const result = await prisma.lead.updateMany({
            where: { status: 'NEW' },
            data: { status: 'Nuevo' }
        });
        console.log(`✅ Fixed ${result.count} leads (Updated to 'Nuevo').`);
    } else {
        console.log("✅ No repair needed.");
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
