
import fetch from 'node-fetch';

const API_URL = 'http://localhost:3001';

async function testTimerFlow() {
    console.log('🚀 Starting Timer Flow Verification');

    // 1. Login as Test Admin
    console.log('🔑 Logging in...');
    const loginRes = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test@chronus.dev', password: 'demo123' })
    });

    if (!loginRes.ok) {
        throw new Error(`Login failed: ${loginRes.statusText}`);
    }

    const { token, user } = await loginRes.json();
    console.log(`✅ Logged in as ${user.name}`);

    // 2. Get Project
    const projRes = await fetch(`${API_URL}/projects`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const projects = await projRes.json();
    if (projects.length === 0) throw new Error('No projects found');
    // 2.5 Check for active timer and stop it
    console.log('🔄 Checking for active timers...');
    const currentRes = await fetch(`${API_URL}/timelogs/current`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });

    if (currentRes.ok) {
        const currentData = await currentRes.json();
        // Check if it's an actual active timer (has start but no end, or just the object exists)
        // API usually returns the active timer object or empty/null
        if (currentData && currentData.id && !currentData.end) {
            console.log(`⚠️ Found active timer (${currentData.id}). Stopping it...`);
            await fetch(`${API_URL}/timelogs/stop`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ timelogId: currentData.id })
            });
            console.log('✅ Active timer stopped');
        }
    }

    const projectId = projects[0].id;

    // 3. Create Task
    const taskRes = await fetch(`${API_URL}/tasks`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            projectId,
            title: 'Timer Verification Task',
            description: 'Testing timer flow',
            priority: 'MEDIUM'
        })
    });
    const task = await taskRes.json();
    console.log(`✅ Task created: ${task.id}`);

    // 4. Start Timer
    console.log('⏱️ Starting timer...');
    const startRes = await fetch(`${API_URL}/timelogs/start`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            projectId,
            taskId: task.id,
            description: 'Testing timer'
        })
    });

    if (!startRes.ok) {
        console.error('❌ Start timer failed:', await startRes.text());
        return;
    }
    const timeLog = await startRes.json();
    console.log(`✅ Timer started: ${timeLog.id}`);

    // Wait 2 seconds
    await new Promise(r => setTimeout(r, 2000));

    // 5. Stop Timer
    console.log('⏹️ Stopping timer...');
    const stopRes = await fetch(`${API_URL}/timelogs/stop`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            timelogId: timeLog.id, // Correct parameter name from api.ts
        })
    });

    // Wait, backend might handle stop differently.
    // If stopRes is 404, maybe endpoint is different or body needs something else.
    // Let's assume standard behavior: POST /timelogs/stop stops current running timer.

    if (!stopRes.ok) {
        console.error('❌ Stop timer failed:', await stopRes.text());
    } else {
        const stoppedLog = await stopRes.json();
        console.log(`✅ Timer stopped. End time: ${stoppedLog.endTime}`);
        console.log(`Duration: ${stoppedLog.duration} seconds (approx)`);
    }

    // Cleanup
    await fetch(`${API_URL}/tasks/${task.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log('✅ Cleanup done');
}

testTimerFlow().catch(console.error);
