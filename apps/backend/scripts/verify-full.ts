
import axios from 'axios';
import { PrismaClient } from '@prisma/client';

const API_URL = 'http://localhost:3001';
const prisma = new PrismaClient();

// Test Data
const TEST_EMAIL = 'admin@chronus.com';
const TEST_PASSWORD = 'password123';
let TOKEN = '';
let ORG_ID = '';
let CLIENT_ID = '';
let PROJECT_ID = '';
let TASK_ID = '';
let USER_ID = '';

async function runTest() {
    console.log('🚀 Starting ChronusDev Full System Verification...');

    try {
        // 1. Authentication
        console.log('\n🔐 Testing Authentication...');
        const authRes = await axios.post(`${API_URL}/auth/login`, {
            email: TEST_EMAIL,
            password: TEST_PASSWORD
        });

        if (!authRes.data.token) throw new Error('Login failed: No token received');
        TOKEN = authRes.data.token;
        USER_ID = authRes.data.user.id;
        ORG_ID = authRes.data.user.organization.id;
        console.log(`✅ Login successful! Token received. Org ID: ${ORG_ID}`);

        // 2. Organization & Clients (Sync Verification)
        console.log('\n🏢 Testing Organization & synced Clients...');
        const clientsRes = await axios.get(`${API_URL}/clients`, {
            headers: { Authorization: `Bearer ${TOKEN}` }
        });

        if (clientsRes.data.length === 0) console.warn('⚠️ No clients found (Sync might be empty)');
        else {
            console.log(`✅ Found ${clientsRes.data.length} clients.`);
            CLIENT_ID = clientsRes.data[0].id;
        }

        // 3. Project Management
        console.log('\n📁 Testing Project Creation...');
        const projectRes = await axios.post(`${API_URL}/projects`, {
            name: `Test Project ${Date.now()}`,
            description: 'Automated test project',
            budget: 5000,
            clientId: CLIENT_ID || undefined,
            status: 'ACTIVE'
        }, { headers: { Authorization: `Bearer ${TOKEN}` } });

        PROJECT_ID = projectRes.data.id;
        console.log(`✅ Project created: ${PROJECT_ID} (${projectRes.data.name})`);

        // 4. Task Management
        console.log('\n✅ Testing Task Creation...');
        const taskRes = await axios.post(`${API_URL}/tasks`, {
            projectId: PROJECT_ID,
            title: 'Implement Core Features',
            description: 'Full stack implementation',
            priority: 'HIGH',
            estimatedHours: 10,
            assignedToId: USER_ID
        }, { headers: { Authorization: `Bearer ${TOKEN}` } });

        TASK_ID = taskRes.data.id;
        console.log(`✅ Task created: ${TASK_ID}`);

        // 5. Comments
        console.log('\n💬 Testing Comments...');
        await axios.post(`${API_URL}/tasks/${TASK_ID}/comments`, {
            content: 'This is a test comment'
        }, { headers: { Authorization: `Bearer ${TOKEN}` } });
        console.log('✅ Comment added.');

        // 6. Time Logging
        console.log('\n⏱️ Testing Time Logging...');
        const start = new Date();
        const end = new Date(start.getTime() + 3600000); // 1 hour later

        await axios.post(`${API_URL}/timelogs`, {
            projectId: PROJECT_ID,
            taskId: TASK_ID,
            start: start.toISOString(),
            end: end.toISOString(),
            description: 'Coding session'
        }, { headers: { Authorization: `Bearer ${TOKEN}` } });
        console.log('✅ Time log added (1 hour).');

        // 7. Reports & Summary
        console.log('\n📊 Testing Project Summary...');
        const summaryRes = await axios.get(`${API_URL}/projects/${PROJECT_ID}/summary`, {
            headers: { Authorization: `Bearer ${TOKEN}` }
        });

        console.log('Summary:', JSON.stringify(summaryRes.data, null, 2));
        if (summaryRes.data.totalHours < 1) throw new Error('Time log not reflected in summary');
        console.log('✅ Project summary verified.');

        // 8. Payouts
        console.log('\n💰 Testing Payout Creation...');
        await axios.post(`${API_URL}/payouts`, {
            userId: USER_ID,
            amount: 100,
            month: '2026-02',
            note: 'Test Payout'
        }, { headers: { Authorization: `Bearer ${TOKEN}` } });
        console.log('✅ Payout record created.');

        console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY!');

    } catch (error: any) {
        console.error('\n❌ TEST FAILED');
        if (error.response) {
            console.error(`Status: ${error.response.status}`);
            console.error('Data:', JSON.stringify(error.response.data, null, 2));
        } else {
            console.error(error.message);
        }
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

runTest();
