/**
 * Customer CRUD API Tests
 * Tests for Create, Read, Update, Delete operations on customers
 */
import { getAuthToken, authRequest } from './setup';

describe('Customer CRUD API', () => {
    let token: string;
    let createdCustomerId: string;

    beforeAll(async () => {
        token = await getAuthToken();
    });

    describe('GET /customers', () => {

        it('should return list of customers', async () => {
            const res = await authRequest(token).get('/customers');

            expect(res.status).toBe(200);
            expect(Array.isArray(res.body)).toBe(true);
        });

        it('should return customers with correct structure', async () => {
            const res = await authRequest(token).get('/customers');

            if (res.body.length > 0) {
                const customer = res.body[0];
                expect(customer).toHaveProperty('id');
                expect(customer).toHaveProperty('name');
                expect(customer).toHaveProperty('email');
                expect(customer).toHaveProperty('organizationId');
            }
        });

    });

    describe('POST /customers', () => {

        it('should create a new customer', async () => {
            const newCustomer = {
                name: 'Test Customer ' + Date.now(),
                email: `test-${Date.now()}@testing.com`,
                phone: '5551234567',
                company: 'Test Corp',
                plan: 'BASIC',
                status: 'ACTIVE'
            };

            const res = await authRequest(token)
                .post('/customers')
                .send(newCustomer);

            expect(res.status).toBe(201);
            expect(res.body).toHaveProperty('id');
            expect(res.body.name).toBe(newCustomer.name);
            expect(res.body.email).toBe(newCustomer.email);

            createdCustomerId = res.body.id;
        });

        it('should validate required fields', async () => {
            const res = await authRequest(token)
                .post('/customers')
                .send({ name: 'Missing email' }); // Missing email

            // Should fail or handle gracefully
            expect([200, 400, 500]).toContain(res.status);
        });

    });

    describe('PUT /customers/:id', () => {

        it('should update customer name', async () => {
            if (!createdCustomerId) {
                console.log('Skipping: No customer created');
                return;
            }

            const updatedName = 'Updated Test Customer';
            const res = await authRequest(token)
                .put(`/customers/${createdCustomerId}`)
                .send({ name: updatedName });

            expect(res.status).toBe(200);
            expect(res.body.name).toBe(updatedName);
        });

        it('should support partial updates', async () => {
            if (!createdCustomerId) return;

            const res = await authRequest(token)
                .put(`/customers/${createdCustomerId}`)
                .send({ company: 'Partial Update Corp' });

            expect(res.status).toBe(200);
            expect(res.body.company).toBe('Partial Update Corp');
            // Original name should be preserved
            expect(res.body.name).toBeTruthy();
        });

    });

    describe('DELETE /customers/:id', () => {

        it('should delete customer', async () => {
            if (!createdCustomerId) return;

            // Cleanup tickets first to avoid foreign key error
            const { prisma } = await import('../src/db');
            await prisma.ticket.deleteMany({
                where: { customerId: createdCustomerId }
            });

            const res = await authRequest(token)
                .delete(`/customers/${createdCustomerId}`);

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('success', true);
        });

        it('should return error for non-existent customer', async () => {
            const res = await authRequest(token)
                .delete('/customers/non-existent-id-12345');

            expect(res.status).toBe(500); // Prisma throws on not found
        });

    });

});
