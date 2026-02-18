
import 'dotenv/config';
import fetch from 'node-fetch';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const API_URL = 'http://localhost:3002'; // CRM Backend
const JWT_SECRET = process.env.JWT_SECRET || 'chronus-crm-super-secret-key-change-in-production';

async function main() {
    console.log('🔍 Debugging CRM Client Fetch...');

    const user = await prisma.user.findUnique({
        where: { email: 'hello@assistai.lat' }
    });

    if (!user) {
        console.error('❌ User not found');
        return;
    }

    const token = jwt.sign(
        { userId: user.id, email: user.email, name: user.name, role: user.role, organizationId: 'cmlfhy7yc0004sathmv36wae5' },
        JWT_SECRET,
        { expiresIn: '1h' }
    );

    console.log(`🔑 Generated Token for ${user.email} (Org: ${user.organizationId})`);

    try {
        // 2. Fetch Clients
        console.log(`\n📡 Fetching ${API_URL}/clients...`);
        const res = await fetch(`${API_URL}/clients`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        console.log(`Response Status: ${res.status} ${res.statusText}`);

        if (res.ok) {
            const data = await res.json();
            console.log('✅ Data Received:', JSON.stringify(data, null, 2));
        } else {
            const text = await res.text();
            console.error('❌ Error Body:', text);
        }

    } catch (error) {
        console.error('❌ Request Failed:', error);
    }
}

// Need to find the real User ID first to generate a valid token that matches DB constraints if any
// But diagnostic output didn't show User IDs in full. 
// I will just use a real ID if I can see it in previous step.
// Looking at previous step output... 
// User: assistai@chronus.com - ID: cmlfhy7x60000sathgu35q84n (I'm guessing or need to verify)

main();
