
import axios from 'axios';

const API_URL = 'http://localhost:3001';
const ADMIN_EMAIL = 'admin@chronusdev.com';
const ADMIN_PASSWORD = 'admin123';

async function verifyBackend() {
    console.log('🔍 Starting Backend Verification...');

    try {
        // 1. Health Check
        console.log('\n--- 1. Health Check ---');
        const health = await axios.get(`${API_URL}/health`);
        console.log('✅ Health:', health.data);

        // 2. Login
        console.log('\n--- 2. Authentication (Login) ---');
        const loginRes = await axios.post(`${API_URL}/auth/login`, {
            email: ADMIN_EMAIL,
            password: ADMIN_PASSWORD
        });
        const { token, user } = loginRes.data;
        console.log(`✅ Logged in as: ${user.name} (${user.email})`);
        console.log(`🔑 Token received: ${token.substring(0, 20)}...`);

        const config = {
            headers: { Authorization: `Bearer ${token}` }
        };

        // 3. User Profile
        console.log('\n--- 3. User Profile (Me) ---');
        const meRes = await axios.get(`${API_URL}/auth/me`, config);
        console.log(`✅ Current User Org: ${meRes.data.memberships[0].organization.name}`);

        // 4. List Organizations
        console.log('\n--- 4. List Organizations ---');
        const orgsRes = await axios.get(`${API_URL}/organizations/mine`, config);
        console.log(`✅ Organizations found: ${orgsRes.data.length}`);
        orgsRes.data.forEach((o: any) => console.log(`   - ${o.name} (${o.role})`));

        // 5. List Users
        console.log('\n--- 5. List Users ---');
        const usersRes = await axios.get(`${API_URL}/users`, config);
        console.log(`✅ Users in Org: ${usersRes.data.length}`);
        usersRes.data.forEach((u: any) => console.log(`   - ${u.name} (${u.role})`));

        // 6. Create User
        console.log('\n--- 6. Create User ---');
        const timestamp = Date.now();
        const newUserEmail = `testuser_${timestamp}@chronusdev.com`;
        try {
            const createRes = await axios.post(`${API_URL}/users`, {
                name: `Test User ${timestamp}`,
                email: newUserEmail,
                password: 'password123',
                role: 'DEV'
            }, config);
            console.log(`✅ User created: ${createRes.data.name}`);
            const newUserId = createRes.data.id;

            // 7. Update User
            console.log('\n--- 7. Update User ---');
            const updateRes = await axios.put(`${API_URL}/users/${newUserId}`, {
                name: `Updated User ${timestamp}`
            }, config);
            console.log(`✅ User updated: ${updateRes.data.name}`);

            // 8. Delete User
            console.log('\n--- 8. Delete User ---');
            await axios.delete(`${API_URL}/users/${newUserId}`, config);
            console.log(`✅ User deleted`);

        } catch (err: any) {
            console.error('❌ User CRUD failed:', err.response?.data || err.message);
        }

        // 9. Switch Organization (Self-switch test)
        console.log('\n--- 9. Switch Organization ---');
        const currentOrgId = user.organization.id;
        const switchRes = await axios.post(`${API_URL}/organizations/switch`, {
            organizationId: currentOrgId
        }, config);
        console.log(`✅ Switched to org: ${switchRes.data.organization.name}`);

        console.log('\n🎉 Verification Completed Successfully!');

    } catch (error: any) {
        console.error('\n❌ Verification Failed:', error.response?.data || error.message);
        process.exit(1);
    }
}

verifyBackend();
