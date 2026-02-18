
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function check() {
    console.log('Checking user admin@chronus.com...');
    const user = await prisma.user.findUnique({
        where: { email: 'admin@chronus.com' }
    });

    if (!user) {
        console.log('User NOT FOUND in database!');
    } else {
        console.log('User found:', user.email);
        console.log('Checking password "demo123"...');
        const match = await bcrypt.compare('demo123', user.password);
        console.log('Password match:', match);

        if (!match) {
            console.log('Trying "password123"...');
            const match2 = await bcrypt.compare('password123', user.password);
            console.log('Password match (password123):', match2);
        }
    }
}

check().catch(console.error).finally(() => prisma.$disconnect());
