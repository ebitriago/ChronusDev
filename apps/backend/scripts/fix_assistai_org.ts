
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const userEmail = 'hello@assistai.lat';
    const targetOrgName = 'Org de Eduardo Bitriago'; // Based on diagnostic output

    console.log(`Finding user ${userEmail}...`);
    const user = await prisma.user.findUnique({ where: { email: userEmail } });
    if (!user) throw new Error('User not found');

    console.log(`Finding org ${targetOrgName}...`);
    const org = await prisma.organization.findFirst({ where: { name: targetOrgName } });
    if (!org) throw new Error('Organization not found');

    console.log(`Checking membership...`);
    const existing = await prisma.organizationMember.findUnique({
        where: {
            userId_organizationId: {
                userId: user.id,
                organizationId: org.id
            }
        }
    });

    if (existing) {
        console.log('User is already a member of this organization.');
    } else {
        console.log('Adding user to organization...');
        await prisma.organizationMember.create({
            data: {
                userId: user.id,
                organizationId: org.id,
                role: 'ADMIN',
                defaultPayRate: 0
            }
        });
        console.log('Successfully added user to organization!');
    }
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
