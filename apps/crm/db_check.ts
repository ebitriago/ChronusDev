
import { PrismaClient } from '@prisma/client';
import { PrismaLibSQL } from '@prisma/adapter-libsql';
import { createClient } from '@libsql/client';

const libsql = createClient({
    url: `file:${process.cwd()}/prisma/dev.db`,
});

const adapter = new PrismaLibSQL(libsql);
const prisma = new PrismaClient({ adapter });

async function main() {
    console.log("Testing DB connection...");
    try {
        const count = await prisma.user.count();
        console.log(`✅ Connection successful. Users count: ${count}`);
    } catch (e) {
        console.error("❌ DB Error:", e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
