
import fetch from 'node-fetch';

const API_URL = 'http://localhost:3002';
const WEBHOOK_URL = 'https://smooth-eggs-stay.loca.lt/whatsmeow/webhook';

async function setWebhook() {
    console.log(`--- Setting Webhook URL to ${WEBHOOK_URL} ---`);

    try {
        // 1. Login
        const loginRes = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'admin@chronus.dev', password: 'admin' })
        });

        let token = '';
        if (loginRes.ok) {
            const data = await loginRes.json();
            token = data.token;
        } else {
            // Try registering if login fails
            const regRes = await fetch(`${API_URL}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: `config-${Date.now()}@test.com`, password: 'password123', name: 'Config User' })
            });
            if (regRes.ok) {
                const data = await regRes.json();
                token = data.token;
            } else {
                throw new Error('Could not get auth token from Login OR Register');
            }
        }

        // 2. Disable test provider if exists to avoid webhook conflict
        console.log('Disabling test provider (placeholder-whatsmeow)...');
        try {
            await fetch(`${API_URL}/whatsapp/providers/placeholder-whatsmeow`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ enabled: false })
            });
        } catch (e) {
            console.log('Test provider not found or error disabling (ignoring):', e.message);
        }

        // 3. Configure Webhook
        // The backend's /whatsmeow/configure-webhook endpoint logic (in index.ts) finds the 
        // first enabled WHATSMEOW provider. By disabling the test one above, we increase 
        // chances it picks the REAL one (the user's linked QR session).
        console.log('Sending configuration request...');
        const res = await fetch(`${API_URL}/whatsmeow/configure-webhook`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ webhookUrl: WEBHOOK_URL })
        });

        if (res.ok) {
            const data = await res.json();
            console.log('✅ Success:', data);
        } else {
            console.log('❌ Failed:', res.status);
            console.log('Response:', await res.text());
        }

    } catch (e) {
        console.error('Error:', e);
    }
}

setWebhook();
