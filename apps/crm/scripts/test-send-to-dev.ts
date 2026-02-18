
import 'dotenv/config';

async function main() {
    const chronusDevUrl = process.env.CHRONUSDEV_API_URL || 'http://localhost:3005';
    const syncKey = process.env.CRM_SYNC_KEY || 'dev-sync-key';
    const webhookUrl = `${chronusDevUrl}/webhooks/crm/ticket-created`;

    console.log(`Testing Webhook URL: ${webhookUrl}`);
    console.log(`Sync Key: ${syncKey}`);

    const payload = {
        ticket: {
            id: "test-ticket-id-" + Date.now(),
            title: "Test Ticket from Script",
            description: "Testing sending to dev via script",
            priority: "HIGH",
            status: "OPEN",
            dueDate: new Date().toISOString()
        },
        customer: {
            id: "test-cust-id",
            name: "Test Customer",
            email: "test@example.com",
            company: "Test Co"
        },
        organizationId: "test-org-id"
    };

    try {
        console.log('Sending request...');
        const res = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Sync-Key': syncKey
            },
            body: JSON.stringify(payload)
        });

        console.log(`Result Status: ${res.status}`);
        const text = await res.text();
        console.log(`Result Body: ${text}`);

        if (res.ok) {
            console.log('✅ SUCCESS: Webhook reached and processed.');
        } else {
            console.log('❌ FAILED: Webhook returned error.');
        }
    } catch (e: any) {
        console.error('❌ CONNECTION ERROR:', e.message);
        if (e.cause) console.error('Cause:', e.cause);
    }
}

main();
