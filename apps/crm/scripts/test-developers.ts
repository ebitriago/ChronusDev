
const API_URL = 'http://localhost:3002';

async function runTest() {
    console.log('🚀 Starting Developers Portal Integration Test...');

    try {
        // 1. Authenticate
        const email = `devtest_${Date.now()}@example.com`;
        const password = 'Password123!';

        console.log(`1. Registering test user: ${email}`);
        await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, name: 'Dev Test User' })
        });

        const loginRes = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const loginData = await loginRes.json();
        const token = loginData.token;
        if (!token) throw new Error('Login failed: ' + JSON.stringify(loginData));

        console.log('✅ Authenticated. Token received.');

        const headers = {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };

        // 2. Test API Keys
        console.log('\n2. Testing API Keys...');

        // List (Empty)
        const list1Res = await fetch(`${API_URL}/api-keys`, { headers });
        const list1 = await list1Res.json();
        console.log(`   Initial Keys: ${list1.length}`);

        // Create
        const createRes = await fetch(`${API_URL}/api-keys`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ name: 'Test Key' })
        });
        const newKey = await createRes.json();
        console.log(`   Created Key: ${newKey.keyPrefix}... (ID: ${newKey.id})`);

        if (!newKey.key.startsWith('sk_live_')) throw new Error('Invalid key format');

        // List (Should have 1)
        const list2Res = await fetch(`${API_URL}/api-keys`, { headers });
        const list2 = await list2Res.json();
        console.log(`   Keys after creation: ${list2.length}`);
        if (list2.length !== 1) throw new Error('List count mismatch');

        // Revoke
        await fetch(`${API_URL}/api-keys/${newKey.id}`, {
            method: 'DELETE',
            headers
        });
        console.log('   Revoked Key.');

        const list3Res = await fetch(`${API_URL}/api-keys`, { headers });
        const list3 = await list3Res.json();
        if (list3.length !== 0) throw new Error('Key not removed');
        console.log('✅ API Keys Test Passed');

        // 3. Test Webhooks
        console.log('\n3. Testing Webhooks...');

        // Create
        const hookRes = await fetch(`${API_URL}/webhooks`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                url: 'https://webhook.site/test',
                description: 'Test Hook',
                events: ['*']
            })
        });
        const hook = await hookRes.json();
        console.log(`   Created Webhook: ${hook.url} (ID: ${hook.id})`);

        // Test Trigger
        const testRes = await fetch(`${API_URL}/webhooks/${hook.id}/test`, {
            method: 'POST',
            headers,
            body: JSON.stringify({})
        });
        const testData = await testRes.json();
        if (!testData.success) throw new Error('Webhook test failed');
        console.log('   Webhook Test Event Triggered.');

        // Delete
        await fetch(`${API_URL}/webhooks/${hook.id}`, {
            method: 'DELETE',
            headers
        });
        console.log('   Deleted Webhook.');
        console.log('✅ Webhooks Test Passed');

        console.log('\n🎉 ALL TESTS PASSED!');

    } catch (error: any) {
        console.error('❌ Test Failed:', error);
        process.exit(1);
    }
}

runTest();
