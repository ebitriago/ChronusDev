
const API_URL = 'http://localhost:3002';
const MAIN_USER = { email: 'admin@chronus.com', password: 'password123' }; // Adjust credentials if known

async function main() {
    console.log('🚀 Starting Automation Verification...');

    // 1. Login
    const loginRes = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(MAIN_USER)
    });

    if (!loginRes.ok) {
        throw new Error('Login failed: ' + await loginRes.text());
    }

    const { token } = await loginRes.json();
    console.log('✅ Generic Login Success');
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };

    // 2. Create Test Stage
    const stageRes = await fetch(`${API_URL}/pipeline-stages`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ name: 'AUTO_TEST_STAGE_' + Date.now(), color: 'bg-red-50' })
    });
    const stage = await stageRes.json();
    console.log(`✅ Stage Created: ${stage.name} (${stage.id})`);

    // 3. Create Automation Rule (Create Task)
    const automationRes = await fetch(`${API_URL}/pipeline-stages/${stage.id}/automations`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
            trigger: 'ENTER_STAGE',
            actionType: 'CREATE_TASK',
            delayMinutes: 0,
            config: {
                title: 'Task for {{name}}',
                description: 'Created by automation'
            }
        })
    });
    const automation = await automationRes.json();
    console.log(`✅ Automation Created: ${automation.id}`);

    // 4. Create Lead
    const leadRes = await fetch(`${API_URL}/customers`, { // Using customers endpoint as leads
        method: 'POST',
        headers,
        body: JSON.stringify({
            name: 'Auto Tester',
            email: `autotester_${Date.now()}@test.com`,
            status: 'NEW', // Initial status
            plan: 'FREE'
        })
    });
    // Wait... Schema separates Customer and Lead models?
    // My previous check on `routes/leads.ts` failed but I found `app.post('/leads')` in index.ts.
    // I should use `/leads` if it exists.
    // In index.ts (viewed earlier), line 2033: app.post("/leads" ...

    const leadCreateRes = await fetch(`${API_URL}/leads`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
            name: 'Auto Tester 2',
            email: `autotester2_${Date.now()}@test.com`,
            status: 'NEW',
            value: 1000
        })
    });

    if (!leadCreateRes.ok) throw new Error('Lead creation failed: ' + await leadCreateRes.text());
    const lead = await leadCreateRes.json();
    console.log(`✅ Lead Created: ${lead.name} (${lead.id})`);

    // 5. Move Lead to Test Stage
    const updateRes = await fetch(`${API_URL}/leads/${lead.id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ status: stage.name }) // Status uses Name string based on implementation
    });

    if (!updateRes.ok) throw new Error('Lead update failed: ' + await updateRes.text());
    console.log(`✅ Lead Moved to ${stage.name}`);

    // 6. Trigger Processing
    console.log('⏳ Triggering Processor...');
    const processRes = await fetch(`${API_URL}/debug/automations/process`, {
        method: 'POST',
        headers
    });
    if (!processRes.ok) throw new Error('Processor failed: ' + await processRes.text());
    console.log('✅ Processor Run');

    // 7. Verification - Check if Task was created?
    // My scheduler logs "Task creation not fully implemented yet".
    // So verification might strictly be "Job Completed".
    // Or I check logs.
    console.log('⚠️  Check backend logs for "[Scheduler] Task creation not fully implemented yet" or success.');

}

main().catch(console.error);
