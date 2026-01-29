
import { getAgents, setWebhook } from '../src/whatsmeow';

async function main() {
    try {
        const agents = await getAgents();
        console.log(`Found ${agents.length} agents.`);

        const ngrokUrl = process.argv[2];
        if (!ngrokUrl) {
            console.error('Please provide the ngrok URL as an argument.');
            process.exit(1);
        }

        const webhookUrl = `${ngrokUrl}/api/assistai/webhook`; // Corrected path
        console.log(`Updating webhook to: ${webhookUrl}`);

        for (const agent of agents) {
            console.log(`Updating agent ${agent.code}...`);
            try {
                await setWebhook(agent.code, agent.token, webhookUrl);
                console.log(`Successfully updated webhook for agent ${agent.code}`);
            } catch (error) {
                console.error(`Failed to update agent ${agent.code}:`, error);
            }
        }
    } catch (error) {
        console.error('Error fetching agents:', error);
    }
}

main();
