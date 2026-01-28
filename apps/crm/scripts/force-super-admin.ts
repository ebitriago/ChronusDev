
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const email = 'eduardo@assistai.lat';

    console.log(`Checking user: ${email}...`);

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
        console.error("User not found!");
        process.exit(1);
    }

    console.log(`Current Role: ${user.role}`);

    if (user.role !== 'SUPER_ADMIN') {
        console.log("Updating to SUPER_ADMIN...");
        await prisma.user.update({
            where: { email },
            data: { role: 'SUPER_ADMIN' }
        });
        console.log("Update successful.");
    } else {
        console.log("User is already SUPER_ADMIN.");
    }

    // Verify
    const updated = await prisma.user.findUnique({ where: { email } });
    console.log(`Final Role: ${updated?.role}`);
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
