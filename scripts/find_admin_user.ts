
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        const user = await prisma.user.findFirst({
            where: { role: 'ADMIN' }
        });

        if (user) {
            console.log(`Found Admin: ${user.email}`);
            // We can't see the password hash, but we might know the password if it was seeded.
            // If not, we can reset it to 'password123'

            // For now, let's just print email
        } else {
            console.log('No admin found. Creating one...');
            // Create one with known password
            const bcrypt = require('bcryptjs'); // Need to check if available
            const hash = await bcrypt.hash('password123', 10);

            const newUser = await prisma.user.create({
                data: {
                    email: 'admin@chronus.com',
                    password: hash,
                    name: 'Admin User',
                    role: 'ADMIN',
                    organization: {
                        create: {
                            name: 'Chronus Org',
                            slug: 'chronus',
                            plan: 'ENTERPRISE'
                        }
                    }
                }
            });
            console.log(`Created Admin: ${newUser.email}`);
        }
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
