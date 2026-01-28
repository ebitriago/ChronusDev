
import fetch from 'node-fetch';

const API_URL = 'https://gale-quadrantlike-conformably.ngrok-free.dev';

async function simulateInbound() {
    console.log('--- Simulating Inbound WhatsApp Message ---');

    const payload = {
        body: {
            from: '584120009999@s.whatsapp.net',
            to: '584140000000@s.whatsapp.net',
            type: 'text',
            message: 'Hola desde la simulación de webhook! 🚀',
            pushname: 'Usuario Simulado',
            timestamp: Math.floor(Date.now() / 1000)
        }
    };

    try {
        console.log('Sending webhook POST...');
        const res = await fetch(`${API_URL}/whatsmeow/webhook`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            console.log('Webhook sent successfully!');
            console.log('Status:', res.status);
            console.log('Response:', await res.text());
            console.log('\n✅ CHECK YOUR INBOX NOW. You should see a message from "Usuario Simulado" (+584120009999).');
        } else {
            console.error('Webhook failed:', res.status, res.statusText);
            console.error('Body:', await res.text());
        }

    } catch (e) {
        console.error('Error:', e);
    }
}

simulateInbound();
