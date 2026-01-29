
import 'dotenv/config';

async function main() {
    console.log('--- Debugging AssistAI Connection (Singular Endpoints) ---');

    const config = {
        baseUrl: process.env.ASSISTAI_API_URL || 'https://public.assistai.lat',
        apiToken: process.env.ASSISTAI_API_TOKEN,
        tenantDomain: process.env.ASSISTAI_TENANT_DOMAIN,
        organizationCode: process.env.ASSISTAI_ORG_CODE
    };

    console.log('Config:', {
        ...config,
        apiToken: config.apiToken ? '***' : 'MISSING'
    });

    const headers = {
        'Authorization': `Bearer ${config.apiToken}`,
        'x-tenant-domain': config.tenantDomain,
        'x-organization-code': config.organizationCode,
        'Content-Type': 'application/json'
    };

    try {
        // Test Singular GET /conversation
        console.log(`\n1. Fetching ${config.baseUrl}/api/v1/conversation (take=5)...`);
        const start = Date.now();

        const res = await fetch(`${config.baseUrl}/api/v1/conversation?take=5&order=DESC`, {
            headers,
            signal: AbortSignal.timeout(10000)
        });

        console.log(`Status: ${res.status} ${res.statusText}`);
        if (res.ok) {
            const data = await res.json();
            console.log(`Success! Found ${data.data?.length || 0} conversations.`);
            if (data.data?.length > 0) {
                console.log('Sample Conversation:', JSON.stringify(data.data[0], null, 2));
            }
        } else {
            console.log('Body:', await res.text());
        }
        console.log(`Latency: ${Date.now() - start}ms`);

    } catch (error: any) {
        console.error('Fetch Failed:', error.cause || error.message);
    }
}

main();
