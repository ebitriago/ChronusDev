
import { getAgent } from './src/whatsmeow';

async function main() {
    const agentCode = '4g6sm0Fe5HLlzicO';
    const agentToken = 'YWZpgVSMcq6aydEbLiispk83ZoRIAfGQ';

    console.log(`Fetching Agent Config for ${agentCode}...`);

    try {
        const agent = await getAgent(agentCode, agentToken);
        console.log("✅ Agent Config Retrieved:");
        console.log(`- Webhook URL: ${agent.incomingWebhook}`);
        console.log(`- Device Status: ${JSON.stringify(agent.deviceId)}`);
    } catch (e: any) {
        console.error("❌ Error fetching agent:", e.message);
    }
}

main();
