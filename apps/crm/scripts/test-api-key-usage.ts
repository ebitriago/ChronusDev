
import { randomBytes } from 'crypto';

const API_URL = 'http://localhost:3002'; // Backend URL

async function runTest() {
    console.log("🚀 Starting API Key Usage Test...");

    try {
        // 1. Authenticate (as User)
        const email = `devtest_${Date.now()}@example.com`;
        const password = 'Password123!';

        console.log(`1. Registering test user: ${email}`);
        const regRes = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, name: 'Dev Test User' })
        });

        let token: string;
        if (!regRes.ok) {
            // Try login if exists
            const loginRes = await fetch(`${API_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            if (!loginRes.ok) throw new Error("Auth failed");
            token = (await loginRes.json()).token;
        } else {
            token = (await regRes.json()).token;
        }

        console.log("✅ Authenticated. Token received.");
        const userHeaders = {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };

        // 2. Generate API Key
        console.log("\n2. Generating API Key...");
        const keyName = `Test Key ${Date.now()}`;
        const createKeyRes = await fetch(`${API_URL}/api-keys`, {
            method: 'POST',
            headers: userHeaders,
            body: JSON.stringify({ name: keyName })
        });

        if (!createKeyRes.ok) throw new Error("Failed to create key");

        const newKey = await createKeyRes.json();
        const rawKey = newKey.key;
        console.log(`   Created Key: ${newKey.keyPrefix}... (ID: ${newKey.id})`);

        // 3. Use API Key to Create Customer
        console.log("\n3. Testing Key Access (Creating Customer via API)...");

        const customerEmail = `api_lead_${Date.now()}@test.com`;
        const createCustRes = await fetch(`${API_URL}/customers`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': rawKey
            },
            body: JSON.stringify({
                name: 'API Created Lead',
                email: customerEmail,
                company: 'API Corp',
                status: 'TRIAL'
            })
        });

        if (createCustRes.status === 401) {
            throw new Error("❌ API Key Rejected (401 Unauthorized)");
        }

        if (!createCustRes.ok) {
            const err = await createCustRes.text();
            throw new Error(`❌ Failed to create customer: ${createCustRes.status} ${err}`);
        }

        const customer = await createCustRes.json();
        console.log(`   ✅ Customer Created: ${customer.name} (ID: ${customer.id})`);

        // 4. Verify Customer Exists (Logged in as user)
        const getCustRes = await fetch(`${API_URL}/customers/${customer.id}`, { headers: userHeaders });
        if (!getCustRes.ok) throw new Error("❌ Optimization: Could not verify customer with user token");
        console.log("   ✅ User can see the customer created by API Key.");

        // 5. Cleanup
        console.log("\n4. Cleanup...");
        await fetch(`${API_URL}/api-keys/${newKey.id}`, { method: 'DELETE', headers: userHeaders });
        await fetch(`${API_URL}/customers/${customer.id}`, { method: 'DELETE', headers: userHeaders });
        console.log("✅ Cleanup complete.");

        console.log("\n🎉 API KEY USAGE TEST PASSED!");

    } catch (e) {
        console.error("\n❌ TEST FAILED:", e);
        process.exit(1);
    }
}

runTest();
