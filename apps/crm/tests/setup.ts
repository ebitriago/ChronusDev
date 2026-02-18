/**
 * Test Setup - Shared utilities and mocks for API testing
 */
import request from 'supertest';
import { app } from '../src/index'; // Use relative path to avoid alias issues if any
import { prisma } from '../src/db';

// Test credentials
export const TEST_USER = {
    email: 'jest_admin@chronus.com',
    password: 'password123',
    name: 'Jest Admin'
};

export const INVALID_USER = {
    email: 'invalid@test.com',
    password: 'wrongpassword'
};

// Helper to get auth token
export async function getAuthToken(): Promise<string> {
    // 1. Ensure User Exists
    let user = await prisma.user.findUnique({ where: { email: TEST_USER.email } });
    if (!user) {
        // Create Organization first
        const org = await prisma.organization.create({
            data: {
                name: 'Jest Org',
                slug: `jest-org-${Date.now()}`,
                plan: 'PRO'
            }
        });

        // Create User
        // Note: Password hashing is handled by auth service usually, but for seed we might need manual hash or rely on endpoint registration
        // For integration test, it's better to REGISTER if possible, or manually create with known hash.
        // Importing bcrypt might be needed.
        const bcrypt = await import('bcryptjs');
        const hashedPassword = await bcrypt.hash(TEST_USER.password, 10);

        user = await prisma.user.create({
            data: {
                email: TEST_USER.email,
                name: TEST_USER.name,
                password: hashedPassword,
                role: 'ADMIN'
            }
        });

        // Link
        await prisma.organizationMember.create({
            data: {
                userId: user.id,
                organizationId: org.id,
                role: 'ADMIN'
            }
        });
    }

    // 2. Login
    const res = await request(app)
        .post('/auth/login')
        .send({
            email: TEST_USER.email,
            password: TEST_USER.password
        });

    if (res.body.token) {
        return res.body.token;
    }
    throw new Error('Failed to get auth token: ' + JSON.stringify(res.body));
}

// Helper to make authenticated requests
export function authRequest(token: string) {
    return {
        get: (url: string) => request(app).get(url).set('Authorization', `Bearer ${token}`),
        post: (url: string) => request(app).post(url).set('Authorization', `Bearer ${token}`),
        put: (url: string) => request(app).put(url).set('Authorization', `Bearer ${token}`),
        delete: (url: string) => request(app).delete(url).set('Authorization', `Bearer ${token}`)
    };
}

// Export app for direct usage
export { app };
