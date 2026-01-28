
import { prisma } from '../src/db.js';

async function main() {
    console.log('--- Listing Integrations ---');
    const integrations = await prisma.integration.findMany();

    for (const i of integrations) {
        console.log(`ID: ${i.id}`);
        console.log(`Provider: ${i.provider}`);
        console.log(`Enabled: ${i.isEnabled}`);
        console.log(`Metadata:`, i.metadata);
        console.log(`Creds:`, JSON.stringify(i.credentials).substring(0, 100) + '...');
        console.log('---------------------------');
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
