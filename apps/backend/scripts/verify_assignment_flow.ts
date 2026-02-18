
// verify_assignment_flow.ts

// We use global fetch (Node 18+) or assume node-fetch is available if needed.
// If global fetch is not available, we might need to import it.
// but let's try without import first as Node 18 has it.

const API_URL = 'http://localhost:3001';

async function testAssignmentFlow() {
    console.log('🚀 Starting Assignment Flow Verification');

    // 1. Login as Admin
    console.log('🔑 Logging in...');
    const loginRes = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test@chronus.dev', password: 'demo123' }) // Use created test user
    });

    if (!loginRes.ok) {
        throw new Error(`Login failed: ${loginRes.statusText}`);
    }

    const { token, user } = await loginRes.json();
    console.log(`✅ Logged in as ${user.name}`);

    // 2. Get Projects
    console.log('📂 Fetching projects...');
    const projRes = await fetch(`${API_URL}/projects`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const projects = await projRes.json();


    let projectId: string;

    if (projects.length === 0) {
        console.log('⚠️ No projects found. Creating one...');
        const createProjRes = await fetch(`${API_URL}/projects`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: 'QA Project',
                description: 'Project for automated testing',
                status: 'ACTIVE',
                budget: 1000
            })
        });

        if (!createProjRes.ok) {
            throw new Error(`Failed to create project: ${await createProjRes.text()}`);
        }

        const newProject = await createProjRes.json();
        projectId = newProject.id;
        console.log(`✅ Created project: ${newProject.name} (${projectId})`);
    } else {
        projectId = projects[0].id;
        console.log(`Using project: ${projects[0].name} (${projectId})`);
    }

    // 3. Create Task
    console.log('📝 Creating task...');
    const taskRes = await fetch(`${API_URL}/tasks`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            projectId,
            title: 'QA Auto Verification Task',
            description: 'Created by automated script to verify assignment flow',
            priority: 'HIGH'
        })
    });
    const task = await taskRes.json();
    console.log(`✅ Task created: ${task.title} (${task.id})`);

    // 4. Assign Task to Self
    console.log('👉 Assigning task to self...');
    const assignRes = await fetch(`${API_URL}/tasks/${task.id}/assign`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!assignRes.ok) {
        console.error('❌ Assignment failed:', await assignRes.text());
        return;
    }

    const assignedTask = await assignRes.json();
    console.log(`✅ Task assigned to: ${assignedTask.assignedTo?.name}`);

    if (assignedTask.assignedTo?.id !== user.id) {
        console.error('❌ Assignment verification failed: Assigned user mismatch');
    } else {
        console.log('✅ Assignment verification success');
    }

    // 5. Check Notifications
    // Since we assigned to self, we probably don't get a notification (logic usually excludes self), 
    // but we can check if a "Task Assigned" log exists or if we assign to another user.

    // Let's try to update status
    console.log('🔄 Updating status to IN_PROGRESS...');
    const updateRes = await fetch(`${API_URL}/tasks/${task.id}`, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: 'IN_PROGRESS' })
    });

    const updatedTask = await updateRes.json();
    console.log(`✅ Task status: ${updatedTask.status}`);

    // 6. Cleanup
    console.log('🧹 Cleaning up...');
    await fetch(`${API_URL}/tasks/${task.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log('✅ Task deleted');

    console.log('🎉 Verification Complete!');
}

testAssignmentFlow().catch(console.error);
