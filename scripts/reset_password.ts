
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    try {
        const email = 'bpena@assistai.lat';
        const password = 'password123';
        const hash = await bcrypt.hash(password, 10);

        await prisma.user.update({
            where: { email },
            data: { password: hash }
        });

        console.log(`Password reset for ${email} to ${password}`);
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
