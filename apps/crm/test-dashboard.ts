
import fetch from 'node-fetch';

const API_URL = 'http://localhost:3002';

async function login() {
    // Try login
    let res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@chronuscrm.com', password: 'password123' })
    });

    // If failed, try register (fallback)
    if (!res.ok) {
        console.log('Login failed, trying register...');
        res = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'Test Admin',
                email: `admin-${Date.now()}@test.com`,
                password: 'password123'
            })
        });
    }

    if (!res.ok) throw new Error('Auth failed');
    const data = await res.json();
    return data.token;
}

async function testDashboard() {
    console.log('🚀 Testing Dashboard API...');

    try {
        const token = await login();
        console.log('✅ Auth successful');

        const res = await fetch(`${API_URL}/dashboard/summary`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) {
            const txt = await res.text();
            throw new Error(`API Error: ${res.status} - ${txt}`);
        }

        const data = await res.json();
        console.log('📊 Dashboard Data Received:');
        console.log('Counts:', JSON.stringify(data.counts, null, 2));
        console.log('Financials:', JSON.stringify(data.financials, null, 2));
        console.log('Activity Items:', data.recentActivity.length);

        // Validations
        if (typeof data.counts.openTickets !== 'number') throw new Error('Invalid openTickets count');
        if (typeof data.financials.totalRevenue !== 'number') throw new Error('Invalid totalRevenue');
        if (!Array.isArray(data.recentActivity)) throw new Error('Invalid recentActivity');

        console.log('✅ Dashboard API Validation Passed!');

    } catch (e) {
        console.error('❌ Test Failed:', e);
        process.exit(1);
    }
}

testDashboard();
