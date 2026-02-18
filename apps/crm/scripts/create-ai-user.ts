import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const prisma = new PrismaClient();

async function createAIUser() {
    const EMAIL = 'ai-agent@chronus.com';
    const NAME = 'Chronus AI Agent';

    console.log(`🤖 Creating/Updating AI Service Account: ${EMAIL}`);

    // 1. Ensure User Exists
    let user = await prisma.user.findUnique({ where: { email: EMAIL } });

    if (!user) {
        const hashedPassword = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);
        user = await prisma.user.create({
            data: {
                email: EMAIL,
                name: NAME,
                password: hashedPassword,
                role: 'ADMIN', // specific AI role tailored permissions in future
            }
        });
        console.log(`✅ User created: ${user.id}`);
    } else {
        console.log(`ℹ️ User already exists: ${user.id}`);
    }

    // 2. Ensure Organization Membership (for the First/Main Org found)
    // In a real multi-tenant setup, you might want to ask which Org to attach to.
    // For now, attaching to the first available organization or ensuring one exists.
    let org = await prisma.organization.findFirst();
    if (!org) {
        console.error("❌ No Organization found. Please create an organization first.");
        process.exit(1);
    }

    // Check if member
    const membership = await prisma.organizationMember.findUnique({
        where: {
            userId_organizationId: {
                userId: user.id,
                organizationId: org.id
            }
        }
    });

    if (!membership) {
        await prisma.organizationMember.create({
            data: {
                userId: user.id,
                organizationId: org.id,
                role: 'ADMIN' // Full access
            }
        });
        console.log(`✅ Added to organization: ${org.name}`);
    }

    // 3. Generate API Key
    const rawKey = 'sk_live_ai_' + crypto.randomBytes(24).toString('hex');
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
    const keyPrefix = rawKey.substring(0, 10);

    const apiKey = await prisma.apiKey.create({
        data: {
            organizationId: org.id,
            name: 'Chronus AI Agent Key',
            keyHash,
            keyPrefix
        }
    });

    console.log(`
🎉 AI Service Account Ready!
---------------------------------------------------
User: ${EMAIL}
Org:  ${org.name}
---------------------------------------------------
🔑 API KEY (SAVE THIS NOW, it won't be shown again):
   ${rawKey}
---------------------------------------------------
Use this key in your MCP Server configuration.
`);
}

createAIUser()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
