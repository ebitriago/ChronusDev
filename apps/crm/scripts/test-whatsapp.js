
import fetch from 'node-fetch';

const API_URL = 'http://localhost:3002';
// We need a token. Using a dummy or login first? 
// The backend uses a simple token check or we can try to register/login.
// index.ts:52 -> users.find((u) => u.token === token ...
// We can seed a user or just try to use a known dev token if any.
// Let's try to login as a dev user first.

async function test() {
    console.log('--- Testing WhatsApp Integration ---');

    // 1. Login
    console.log('1. Logging in...');
    try {
        const loginRes = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'admin@chronus.dev', password: 'admin' }) // Guessing default credentials or we create one
        });

        let token = '';
        if (loginRes.ok) {
            const data = await loginRes.json();
            token = data.token;
            console.log('   Login successful. Token:', token.substring(0, 10) + '...');
        } else {
            // Try registering if login fails
            console.log('   Login failed, trying to register temp admin...');
            const regRes = await fetch(`${API_URL}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: `test-${Date.now()}@test.com`, password: 'password123', name: 'Test User' })
            });
            if (regRes.ok) {
                const data = await regRes.json();
                token = data.token;
                console.log('   Registration successful. Token:', token);
            } else {
                throw new Error('Could not get auth token');
            }
        }

        // 2. Fetch Providers
        console.log('\n2. Fetching Providers...');
        const providersRes = await fetch(`${API_URL}/whatsapp/providers`, {
            headers: { 'Authorization': token } // The middleware accepts raw token if it matches user.token
        });

        if (!providersRes.ok) throw new Error(`Failed to fetch providers: ${providersRes.status}`);
        const providers = await providersRes.json();
        console.log(`   Found ${providers.length} providers`);

        // 3. Ensure WhatsMeow Provider exists
        let wmProvider = providers.find(p => p.type === 'whatsmeow');
        if (!wmProvider) {
            console.log('   Creating placeholder WhatsMeow provider...');
            // In the code, fetching providers automatically adds placeholders if missing!
            // So if we didn't find one in the response, something is odd, or we need to use the placeholder ID from the response?
            // "if (!hasWhatsMeow) providers.push({ id: 'placeholder-whatsmeow' ... })"
            // Ah, the response should HAVE it.
            const placeholder = providers.find(p => p.id === 'placeholder-whatsmeow');
            if (placeholder) {
                console.log('   Found placeholder, clicking "Configure" (PUT)...');
                // We must "save" it to make it real in DB
                const createRes = await fetch(`${API_URL}/whatsapp/providers/placeholder-whatsmeow`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', 'Authorization': token },
                    body: JSON.stringify({
                        name: 'WhatsMeow Test',
                        enabled: true,
                        config: { apiUrl: 'https://whatsapp.qassistai.work/api/v1' } // Assuming this is the global one
                    })
                });
                if (!createRes.ok) throw new Error('Failed to create provider');
                const created = await createRes.json();
                wmProvider = created;
                console.log('   Provider created/updated:', created.id);
            } else {
                throw new Error('No WhatsMeow provider or placeholder found');
            }
        }

        if (!wmProvider) throw new Error('Could not get WhatsMeow provider');
        console.log('   Using Provider ID:', wmProvider.id);

        // 4. Get QR
        console.log('\n4. Fetching QR Code...');
        const qrRes = await fetch(`${API_URL}/whatsapp/providers/${wmProvider.id}/qr`, {
            headers: { 'Authorization': token }
        });

        if (qrRes.ok) {
            const qrData = await qrRes.json();
            console.log('   QR Response Status: OK');
            console.log('   QR Data Length:', qrData.qr?.length);
            console.log('   QR Preview:', qrData.qr?.substring(0, 50));

            if (qrData.status === 'connected') {
                console.log('   Status: ALREADY CONNECTED (Expected)');
            } else if (qrData.qr && qrData.qr.startsWith('data:image')) {
                console.log('   SUCCESS: Valid Data URI received');
            } else {
                console.log('   WARNING: QR format might be raw or invalid or missing');
            }
        } else {
            console.log('   QR URL:', `${API_URL}/whatsapp/providers/${wmProvider.id}/qr`);
            console.log('   QR Fetch Failed:', qrRes.status, qrRes.statusText);
            const err = await qrRes.text();
            console.log('   Error Body:', err);
        }

        // 5. Send Message
        console.log('\n5. Sending Test Message...');
        const sendRes = await fetch(`${API_URL}/whatsapp/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': token },
            body: JSON.stringify({
                providerId: wmProvider.id,
                to: '584140000000', // Dummy number, or asking user? Let's use a safe dummy.
                content: 'Test message from integration script'
            })
        });

        if (sendRes.ok) {
            console.log('   Message Sent Successfully');
            const sendData = await sendRes.json();
            console.log('   Message ID:', sendData.message?.id);
        } else {
            console.log('   Send Failed:', sendRes.status);
            const err = await sendRes.text();
            console.log('   Error:', err);
        }

    } catch (e) {
        console.error('ERROR:', e);
    }
}

test();
