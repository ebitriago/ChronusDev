import { PrismaClient } from '@prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import path from 'path';

const dbPath = path.resolve(process.cwd(), 'prisma', 'dev.db');
const adapter = new PrismaLibSql({ url: `file:${dbPath}` });
const prisma = new PrismaClient({ adapter });

async function checkMessages() {
    console.log('--- Checking DB Messages ---');
    try {
        const conversations = await prisma.conversation.findMany({
            include: { messages: true }
        });

        console.log(`Found ${conversations.length} conversations.`);

        conversations.forEach(c => {
            console.log(`\nSession: ${c.sessionId} (${c.customerName})`);
            console.log(`Messages: ${c.messages.length}`);
            c.messages.forEach(m => {
                console.log(` - [${m.sender}] ${m.content.substring(0, 50)}`);
            });
        });

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

checkMessages();
