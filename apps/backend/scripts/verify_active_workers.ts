
import { PrismaClient } from '@prisma/client';
import fetch from 'node-fetch';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const API_URL = 'http://localhost:3001';

async function verifyActiveWorkers() {
    try {
        console.log('Setting up test user...');
        const email = 'test-worker@chronus.com';
        const password = 'demo123';
        const hashedPassword = await bcrypt.hash(password, 10);

        // 1. Ensure Organization exists
        let org = await prisma.organization.findFirst({ where: { slug: 'test-org' } });
        if (!org) {
            org = await prisma.organization.create({
                data: {
                    name: 'Test Org',
                    slug: 'test-org',
                    enabledServices: 'CHRONUSDEV',
                    subscriptionStatus: 'ACTIVE'
                }
            });
        }

        // 2. Upsert User
        const user = await prisma.user.upsert({
            where: { email },
            update: { password: hashedPassword },
            create: {
                email,
                name: 'Test Worker',
                password: hashedPassword,
                role: 'DEV',
                memberships: {
                    create: {
                        organizationId: org.id,
                        role: 'DEV',
                        defaultPayRate: 20
                    }
                }
            },
            include: { memberships: true }
        });

        console.log(`User ready: ${user.email}`);

        // 3. Login
        const loginRes = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        if (!loginRes.ok) {
            const err = await loginRes.json();
            throw new Error(`Login failed: ${JSON.stringify(err)}`);
        }

        const loginData: any = await loginRes.json();
        const token = loginData.token;
        console.log('Login successful');

        // 4. Create Project
        let project = await prisma.project.findFirst({
            where: {
                organizationId: org.id,
                name: 'Active Worker Test Project'
            }
        });

        if (!project) {
            project = await prisma.project.create({
                data: {
                    name: 'Active Worker Test Project',
                    organizationId: org.id,
                    status: 'ACTIVE'
                }
            });
        }

        // Ensure membership exists for this project if required by logic
        const pm = await prisma.projectMember.findFirst({
            where: { projectId: project.id, userId: user.id }
        });
        if (!pm) {
            await prisma.projectMember.create({
                data: {
                    projectId: project.id,
                    userId: user.id,
                    role: 'DEV',
                    payRate: 20,
                    billRate: 40
                }
            });
        }

        // 5. Create Task
        const taskRes = await fetch(`${API_URL}/tasks`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                projectId: project.id,
                title: 'Task for Active Worker Test ' + Date.now(),
                description: 'Testing visibility'
            })
        });

        if (!taskRes.ok) {
            const err = await taskRes.json();
            throw new Error(`Failed to create task: ${JSON.stringify(err)}`);
        }
        const task: any = await taskRes.json();
        console.log('Task created:', task.id);

        // 6. Start Timer
        console.log('Starting timer...');
        const startRes = await fetch(`${API_URL}/timelogs/start`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                taskId: task.id,
                projectId: project.id
            })
        });

        // Handle case where timer might be running from previous failed run
        if (!startRes.ok) {
            const err: any = await startRes.json();
            if (err.error?.includes('Ya tienes un temporizador') || err.error?.includes('already')) {
                console.log('Timer already running, stopping it first...');
                const currentTimerRes = await fetch(`${API_URL}/timelogs/current`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const current: any = await currentTimerRes.json();
                if (current) {
                    await fetch(`${API_URL}/timelogs/stop`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({ timelogId: current.id })
                    });
                    // Retry start
                    console.log('Retrying start timer...');
                    const retryStart = await fetch(`${API_URL}/timelogs/start`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({ taskId: task.id, projectId: project.id })
                    });
                    if (!retryStart.ok) throw new Error('Failed to start timer on retry');
                }
            } else {
                throw new Error(`Failed to start timer: ${JSON.stringify(err)}`);
            }
        }
        console.log('Timer started successfully');

        // 7. Verify Active Workers Response
        console.log('Fetching tasks to verify activeWorkers field...');
        const tasksRes = await fetch(`${API_URL}/tasks?projectId=${project.id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const tasksList: any = await tasksRes.json();
        const targetTask = tasksList.find((t: any) => t.id === task.id);

        if (!targetTask) throw new Error('Created task not found in list');

        console.log('Active Workers Response:', JSON.stringify(targetTask.activeWorkers));

        if (targetTask.activeWorkers && Array.isArray(targetTask.activeWorkers) && targetTask.activeWorkers.length > 0) {
            const worker = targetTask.activeWorkers.find((w: any) => w.id === user.id);
            if (worker) {
                console.log('✅ SUCCESS: Active worker correctly returned in API response!');
            } else {
                console.error('❌ FAILURE: User not found in active workers list');
                process.exit(1);
            }
        } else {
            console.error('❌ FAILURE: activeWorkers field is empty or missing');
            process.exit(1);
        }

        // Cleanup: Stop timer
        const currentTimerRes = await fetch(`${API_URL}/timelogs/current`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const current: any = await currentTimerRes.json();
        if (current) {
            await fetch(`${API_URL}/timelogs/stop`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ timelogId: current.id })
            });
            console.log('Timer stopped (cleanup)');
        }

    } catch (e) {
        console.error(e);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

verifyActiveWorkers();
