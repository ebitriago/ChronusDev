
import fetch from 'node-fetch';

const BASE_URL = 'https://whatsapp.qassistai.work/api/v1';

async function testApi() {
    console.log(`Testing API at ${BASE_URL}`);

    try {
        // 1. Health check (if exists) or List Agents
        console.log('GET /agents');
        const res = await fetch(`${BASE_URL}/agents`);
        if (res.ok) {
            console.log('GET /agents OK');
            const data = await res.json();
            console.log('Agents count:', data.length);
        } else {
            console.log(`GET /agents Failed: ${res.status}`);
            console.log(await res.text());
        }

        // 2. Create Agent
        console.log('\nPOST /agents');
        const createRes = await fetch(`${BASE_URL}/agents`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ incomingWebhook: 'http://localhost:3002/whatsmeow/webhook' })
        });

        if (createRes.ok) {
            console.log('POST /agents OK');
            const agent = await createRes.json();
            console.log('Agent:', agent);
        } else {
            console.log(`POST /agents Failed: ${createRes.status}`);
            console.log(await createRes.text());
        }

    } catch (e) {
        console.error('Error:', e);
    }
}

testApi();
