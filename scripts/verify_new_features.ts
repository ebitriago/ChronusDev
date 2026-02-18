
import fetch from 'node-fetch';

const API_URL = 'http://localhost:3001';
// Use the token from a previous login or hardcode a test token if possible. 
// For this script, we'll simulate the flow or assume a token is provided in env.
// But easier: login as admin first.

const ADMIN_EMAIL = 'bpena@assistai.lat';
const ADMIN_PASSWORD = 'password123';

async function verify() {
    try {
        console.log('1. Logging in...');
        const loginRes = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
        });

        if (!loginRes.ok) throw new Error('Login failed: ' + await loginRes.text());
        const { token, user } = await loginRes.json();
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };
        console.log('Login successful');

        // 2. Project Wiki
        console.log('\n2. Verifying Project Wiki...');
        // Get first project
        const projectsRes = await fetch(`${API_URL}/projects`, { headers });
        const projects = await projectsRes.json();
        if (projects.length === 0) throw new Error('No projects found');
        const projectId = projects[0].id;

        // Create Wiki Page
        const uniqueTitle = `Test Page ${Date.now()}`;
        const wikiRes = await fetch(`${API_URL}/projects/${projectId}/wiki`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ title: uniqueTitle, content: '# Hello World' })
        });
        if (!wikiRes.ok) throw new Error('Create Wiki failed: ' + await wikiRes.text());
        const wikiPage = await wikiRes.json();
        console.log('Wiki Page Created:', wikiPage.id);

        // 3. Daily Standup
        console.log('\n3. Verifying Daily Standup...');
        const standupRes = await fetch(`${API_URL}/standups`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ yesterday: 'Worked on wiki', today: 'Testing', blockers: 'None' })
        });
        if (!standupRes.ok) throw new Error('Create Standup failed: ' + await standupRes.text());
        const standup = await standupRes.json();
        console.log('Standup Created:', standup.id);

        // 4. Task Improvements
        console.log('\n4. Verifying Task Improvements...');
        // Create Task
        const taskRes = await fetch(`${API_URL}/tasks`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                projectId,
                title: 'Test Task Features',
                prLink: 'http://github.com/pr/123',
                checklist: [{ text: 'Item 1', checked: true }, { text: 'Item 2', checked: false }]
            })
        });

        if (!taskRes.ok) throw new Error('Create Task failed: ' + await taskRes.text());
        const task = await taskRes.json();
        console.log('Task Created:', task.id);

        // Verify fields
        if (task.prLink !== 'http://github.com/pr/123') throw new Error('PR Link mismatch');
        if (!Array.isArray(task.checklist) || task.checklist.length !== 2) throw new Error('Checklist mismatch');

        console.log('\n✅ All verifications passed!');

    } catch (error) {
        console.error('\n❌ Verification failed:', error);
        process.exit(1);
    }
}

verify();
