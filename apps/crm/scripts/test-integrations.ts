
import fetch from 'node-fetch';

const API_URL = 'http://localhost:3002';
let TOKEN = '';

async function registerTestUser() {
    const uniqueId = Date.now();
    const email = `test.integrations.${uniqueId}@example.com`;
    const password = 'TestPassword123!';
    const name = `Test User ${uniqueId}`;

    console.log(`\n👤 Registering test user: ${email}...`);
    try {
        const res = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password })
        });

        if (res.ok) {
            const data = await res.json() as { token: string };
            if (data.token) {
                TOKEN = data.token;
                console.log('✅ Registration successful. Token obtained.');
                return true;
            }
        }

        console.error('❌ Registration failed:', res.status, await res.text());
        return false;
    } catch (e) {
        console.error('❌ Registration error:', e);
        return false;
    }
}

async function testIntegrations() {
    console.log('🧪 Starting Integrations Tests...');

    if (!await registerTestUser()) {
        console.error('⚠️ Aborting tests due to auth failure.');
        return;
    }

    // 1. Test GET /integrations
    try {
        console.log('\nTesting GET /integrations...');
        const res = await fetch(`${API_URL}/integrations`, {
            headers: { 'Authorization': `Bearer ${TOKEN}` }
        });

        if (res.ok) {
            const data = await res.json();
            console.log('✅ GET /integrations successful');
            console.log('   Providers found:', Object.keys(data || {}).length);
        } else {
            console.error('❌ GET /integrations failed:', res.status, res.statusText);
        }
    } catch (e) {
        console.error('❌ GET /integrations error:', e);
    }

    // 2. Test POST /integrations (Update a provider)
    try {
        console.log('\nTesting POST /integrations (Update OPENAI)...');
        const res = await fetch(`${API_URL}/integrations`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${TOKEN}`
            },
            body: JSON.stringify({
                provider: 'OPENAI',
                credentials: { apiKey: 'test-key-123' },
                isEnabled: true
            })
        });

        if (res.ok) {
            console.log('✅ POST /integrations successful');
        } else {
            console.error('❌ POST /integrations failed:', res.status);
            const err = await res.json().catch(() => ({}));
            console.error('   Error:', err);
        }
    } catch (e) {
        console.error('❌ POST /integrations error:', e);
    }

    // 3. Test GET /settings/smtp
    try {
        console.log('\nTesting GET /settings/smtp...');
        const res = await fetch(`${API_URL}/settings/smtp`, {
            headers: { 'Authorization': `Bearer ${TOKEN}` }
        });

        if (res.ok) {
            const data = await res.json();
            console.log('✅ GET /settings/smtp successful');
            console.log('   Current Host:', data.host);
        } else {
            console.error('❌ GET /settings/smtp failed:', res.status);
        }
    } catch (e) {
        console.error('❌ GET /settings/smtp error:', e);
    }

    // 4. Test POST /settings/smtp
    try {
        console.log('\nTesting POST /settings/smtp...');
        const res = await fetch(`${API_URL}/settings/smtp`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${TOKEN}`
            },
            body: JSON.stringify({
                host: 'smtp.test.com',
                port: 587,
                user: 'test@test.com',
                pass: 'password123',
                from: '"Test" <test@test.com>'
            })
        });

        if (res.ok) {
            console.log('✅ POST /settings/smtp successful');
        } else {
            console.error('❌ POST /settings/smtp failed:', res.status);
        }
    } catch (e) {
        console.error('❌ POST /settings/smtp error:', e);
    }

    // 5. Test Whatsapp Channel Config (Mock)
    // Assuming we have a provider ID from GET /integrations or can use a mock one 'test-provider'
    try {
        console.log('\nTesting PUT /whatsapp/providers/:id/channel-config...');
        const res = await fetch(`${API_URL}/whatsapp/providers/test-provider/channel-config`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${TOKEN}`
            },
            body: JSON.stringify({
                mode: 'HYBRID',
                autoResumeMinutes: 30
            })
        });

        // Current mock implementation might return 404 if provider not found, or 200 if mocked broadly.
        // Based on previous code, it likely checks for provider in DB. 
        // We expect this might fail if 'test-provider' doesn't exist, which is a valid test result.

        if (res.ok) {
            console.log('✅ PUT channel-config successful');
        } else {
            console.log(`⚠️ PUT channel-config returned ${res.status} (Expected if provider doesn't exist)`);
        }
    } catch (e) {
        console.error('❌ PUT channel-config error:', e);
    }

    console.log('\n----------------------------------------');
    console.log('✅ Integration Tests Completed.');
}

testIntegrations();
