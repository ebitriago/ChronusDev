import { prisma } from './src/db.ts';

async function main() {
    console.log('Seeding Pipeline Automation Demo...');

    // Find or Create Organization
    let org = await prisma.organization.findFirst();
    if (!org) {
        console.log('No organization found. Creating one...');
        org = await prisma.organization.create({
            data: {
                name: 'Demo Organization',
                slug: 'demo'
            }
        });
    }

    // Create a rule: When status -> CONTACTED => Send WhatsApp in 1 min
    const rule = await prisma.pipelineAutomation.create({
        data: {
            organizationId: org.id,
            triggerStatus: 'CONTACTED',
            actionType: 'WHATSAPP',
            actionDelayMinutes: 1,
            actionContent: 'Hola {{name}}, vimos que estás interesado. ¿Tienes alguna duda?',
            isEnabled: true
        }
    });

    console.log('Created Automation Rule:', rule);
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
