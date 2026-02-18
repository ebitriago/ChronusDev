
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const SECRET = process.env.JWT_SECRET || 'chronus-secret-key';

async function main() {
    const email = 'eduardo@assistai.lat';
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
        console.error('User not found');
        return;
    }

    const token = jwt.sign(
        {
            userId: user.id,
            email: user.email,
            role: user.role,
            organizationId: 'cmlfh2gfo0002xt8bwr45j6fx' // Hardcoded logic from what we saw, but normally fetched from memberships
        },
        SECRET,
        { expiresIn: '1h' }
    );

    console.log('TOKEN:', token);
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
