
import { prisma } from './src/db.js';

async function check() {
    try {
        const convs = await prisma.conversation.findMany({
            where: {
                agentName: {
                    contains: 'Claud',
                    mode: 'insensitive'
                }
            },
            take: 10,
            orderBy: { updatedAt: 'desc' }
        });

        console.log(`Found ${convs.length} conversations for 'Claudia':`);
        convs.forEach(c => {
            console.log(` - [${c.platform}] ${c.customerName}: ${c.sessionId} (Agent: ${c.agentName})`);
        });

        if (convs.length === 0) {
            console.log("No conversations found. Checking all agents...");
            const all = await prisma.conversation.groupBy({
                by: ['agentName'],
                _count: true
            });
            console.log(all);
        }

    } catch (e) {
        console.error(e);
    }
}

check();
