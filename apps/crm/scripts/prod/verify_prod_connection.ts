
import { PrismaClient } from '@prisma/client';

async function main() {
    console.log('Verifying Production Database Connection...');

    const prisma = new PrismaClient();

    try {
        const userCount = await prisma.user.count();
        console.log(`Successfully connected! Found ${userCount} users.`);

        // Check organizations (safer read)
        const orgCount = await prisma.organization.count();
        console.log(`Found ${orgCount} organizations.`);

    } catch (error) {
        console.error('Connection failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
