
import fetch from 'node-fetch';

// const API_URL = 'http://localhost:3002';
const API_URL = 'https://gale-quadrantlike-conformably.ngrok-free.dev';

async function simulateSelfMessage() {
    console.log('--- Simulating SELF WhatsApp Message (Agent via Phone) ---');

    const payload = {
        body: {
            from: '584140000000', // My number
            to: '584120009999', // Customer number
            type: 'text',
            message: 'Hola cliente, soy yo el agente desde mi celular',
            pushname: 'Agente Prueba',
            timestamp: Math.floor(Date.now() / 1000),
            is_self_message: true,
            is_owner_sender: true
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
        } else {
            console.error('Webhook failed:', res.status, res.statusText);
            console.error('Body:', await res.text());
        }

    } catch (e) {
        console.error('Error:', e);
    }
}

simulateSelfMessage();
