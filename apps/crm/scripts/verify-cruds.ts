
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'chronus-crm-super-secret-key-change-in-production';
const API_URL = 'http://localhost:3002';

function generateToken(user: any) {
    return jwt.sign(
        {
            userId: user.id,
            email: user.email,
            name: user.name,
            role: 'SUPER_ADMIN', // Force role
            organizationId: user.memberships[0]?.organizationId
        },
        JWT_SECRET,
        { expiresIn: '1h' }
    );
}

async function main() {
    console.log("1. Getting Super Admin User...");
    const user = await prisma.user.findUnique({
        where: { email: 'eduardo@assistai.lat' },
        include: { memberships: { include: { organization: true } } }
    });

    if (!user) {
        console.error("User not found!");
        process.exit(1);
    }

    const token = generateToken(user);
    console.log("Token generated.");

    console.log("\n2. Testing Create Organization...");
    const newOrgName = `Test Org ${Date.now()}`;
    const createRes = await fetch(`${API_URL}/organizations`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
            name: newOrgName,
            enabledServices: "CRM,CHRONUSDEV"
        })
    });

    if (!createRes.ok) {
        console.error("Failed to create org:", await createRes.text());
    } else {
        const org = await createRes.json();
        console.log("Organization created:", org.name, org.id);

        console.log("\n3. Testing List Organizations...");
        const listRes = await fetch(`${API_URL}/organizations`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const orgs = await listRes.json();
        console.log(`Found ${orgs.length} organizations.`);
        const found = orgs.find((o: any) => o.id === org.id);
        if (found) {
            console.log("✅ Verified: Created organization is in the list.");
        } else {
            console.error("❌ Error: Created organization NOT found in list.");
        }
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
