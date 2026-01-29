
import { setWebhook } from './src/whatsmeow';

async function main() {
    const agentCode = '4g6sm0Fe5HLlzicO';
    const agentToken = 'YWZpgVSMcq6aydEbLiispk83ZoRIAfGQ';

    // Get URL from command line arg
    const newUrl = process.argv[2];

    if (!newUrl) {
        console.error("Please provide the new ngrok URL as an argument.");
        process.exit(1);
    }

    const webhookUrl = `${newUrl}/whatsmeow/webhook`;
    console.log(`Updating Webhook for Agent ${agentCode} to: ${webhookUrl}`);

    try {
        const res = await setWebhook(agentCode, agentToken, webhookUrl);
        console.log("✅ Webhook Updated Successfully!");
        console.log(`- New Webhook: ${res.incomingWebhook}`);
    } catch (e: any) {
        console.error("❌ Error updating webhook:", e.message);
    }
}

main();
