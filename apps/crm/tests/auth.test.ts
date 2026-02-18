/**
 * Authentication API Tests
 * Tests for login, token validation, and authorization
 */
import request from 'supertest';
import { app, TEST_USER, INVALID_USER } from './setup';

describe('Authentication API', () => {

    describe('POST /auth/login', () => {

        it('should return token for valid credentials', async () => {
            const res = await request(app)
                .post('/auth/login')
                .send(TEST_USER);

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('success', true);
            expect(res.body).toHaveProperty('token');
            expect(res.body).toHaveProperty('user');
            expect(res.body.user).toHaveProperty('email', TEST_USER.email);
            expect(res.body.user).toHaveProperty('organization');
        });

        it('should return error for invalid credentials', async () => {
            const res = await request(app)
                .post('/auth/login')
                .send(INVALID_USER);

            expect(res.status).toBe(401);
            expect(res.body).toHaveProperty('error');
        });

        it('should include organization info in response', async () => {
            const res = await request(app)
                .post('/auth/login')
                .send(TEST_USER);

            expect(res.body.user).toHaveProperty('organizations');
            expect(Array.isArray(res.body.user.organizations)).toBe(true);
            expect(res.body.user.organizations.length).toBeGreaterThan(0);
            expect(res.body.user.organizations[0]).toHaveProperty('enabledServices');
        });

    });

    describe('Protected Routes', () => {

        it('should reject requests without token', async () => {
            const res = await request(app).get('/customers');
            expect(res.status).toBe(401);
        });

        it('should reject requests with invalid token', async () => {
            const res = await request(app)
                .get('/customers')
                .set('Authorization', 'Bearer invalid-token-here');
            expect(res.status).toBe(401);
        });

    });

});
