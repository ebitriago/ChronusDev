
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const email = 'eduardo@assistai.lat';
    const user = await prisma.user.findUnique({
        where: { email },
        include: { memberships: true }
    });

    if (!user) {
        console.log(`User ${email} not found!`);
    } else {
        console.log('User found:', JSON.stringify(user, null, 2));
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
