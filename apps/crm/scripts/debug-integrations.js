
import { PrismaClient } from '@prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import fetch from 'node-fetch';
import path from 'path';

const dbPath = path.resolve(process.cwd(), 'prisma', 'dev.db');
const adapter = new PrismaLibSql({ url: `file:${dbPath}` });
const prisma = new PrismaClient({ adapter });

async function checkIntegrations() {
    console.log('--- Checking All Integrations ---');
    try {
        console.log('--- Finding Specific Integration ---');
        // Target ID from user logs
        const targetId = 'cmkrr4j0d0002gf11zh6e5k86';

        const integration = await prisma.integration.findUnique({
            where: { id: targetId },
            include: { user: true }
        });

        if (!integration) {
            console.log(`Integration ${targetId} NOT FOUND.`);
            return;
        }

        console.log(`Found Integration: ${integration.id}`);
        console.log(`Owner: ${integration.user?.email || 'System'}`);
        console.log(`Provider: ${integration.provider}`);
        console.log(`Enabled: ${integration.isEnabled}`);

        const currentCreds = integration.credentials;
        console.log('Current Credentials:', JSON.stringify(currentCreds, null, 2));

        const WEBHOOK_URL = 'https://gale-quadrantlike-conformably.ngrok-free.dev/whatsmeow/webhook';

        const newCreds = {
            ...currentCreds,
            webhookUrl: WEBHOOK_URL
        };

        console.log('--- Updating Webhook URL in DB ---');
        await prisma.integration.update({
            where: { id: targetId },
            data: {
                isEnabled: true,
                credentials: newCreds
            }
        });
        console.log('✅ Integration updated in DB!');

        // CALL EXTERNAL API
        console.log('--- Calling External WhatsMeow API ---');
        const agentCode = currentCreds.agentCode;
        const agentToken = currentCreds.agentToken;

        if (!agentCode || !agentToken) {
            console.error('❌ Missing agentCode or agentToken. REPAIRING...');

            // Create New Agent
            const createUrl = `https://whatsapp.qassistai.work/api/v1/agents`;
            console.log(`POST ${createUrl}`);
            const createRes = await fetch(createUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ incomingWebhook: WEBHOOK_URL })
            });

            if (!createRes.ok) {
                throw new Error('Failed to create new agent: ' + await createRes.text());
            }

            const newAgent = await createRes.json();
            console.log('✅ New Agent Created:', newAgent);

            // Save new credentials
            const repairedCreds = {
                ...currentCreds,
                agentCode: newAgent.code,
                agentToken: newAgent.token,
                webhookUrl: WEBHOOK_URL,
                apiUrl: 'https://whatsapp.qassistai.work/api/v1'
            };

            await prisma.integration.update({
                where: { id: targetId },
                data: { credentials: repairedCreds }
            });
            console.log('✅ Database updated with new credentials.');
            return; // Done, skipping external update as createAgent already set webhook
        }

        const externalUrl = `https://whatsapp.qassistai.work/api/v1/agents/${agentCode}`;
        console.log(`PUT ${externalUrl}`);

        const res = await fetch(externalUrl, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-Token': agentToken
            },
            body: JSON.stringify({ incomingWebhook: WEBHOOK_URL })
        });

        if (res.ok) {
            console.log('✅ External Webhook Configured Successfully!');
            console.log(await res.json());
        } else {
            console.error('❌ External API Failed:', res.status);
            console.error(await res.text());
        }

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

checkIntegrations();
