
import { PrismaClient } from '@prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import path from 'path';

const adapter = new PrismaLibSql({ url: `file:${path.join(process.cwd(), 'apps/crm/prisma/dev.db')}` });
const prisma = new PrismaClient({ adapter });

async function checkUsers() {
    const users = await prisma.user.findMany();
    console.log('Users found:', users.map(u => ({ email: u.email, role: u.role })));
}

checkUsers().finally(() => prisma.$disconnect());
