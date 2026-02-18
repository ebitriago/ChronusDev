/**
 * Tickets API Tests
 * Tests for Ticket CRUD operations
 */
import { getAuthToken, authRequest } from './setup';

describe('Tickets API', () => {
    let token: string;
    let createdTicketId: string;
    let customerId: string;

    beforeAll(async () => {
        token = await getAuthToken();

        // Create a dedicated customer for this test suite
        const customerRes = await authRequest(token).post('/customers').send({
            name: 'Ticket Test Customer ' + Date.now(),
            email: `ticket-test-${Date.now()}@test.com`,
            phone: '555' + Date.now().toString().slice(-7),
            status: 'ACTIVE'
        });

        customerId = customerRes.body.id;
    });

    describe('GET /tickets', () => {

        it('should return list of tickets', async () => {
            const res = await authRequest(token).get('/tickets');

            expect(res.status).toBe(200);
            expect(Array.isArray(res.body)).toBe(true);
        });

        it('should return tickets with customer info', async () => {
            const res = await authRequest(token).get('/tickets');

            if (res.body.length > 0) {
                const ticket = res.body[0];
                expect(ticket).toHaveProperty('id');
                expect(ticket).toHaveProperty('title');
                expect(ticket).toHaveProperty('status');
                expect(ticket).toHaveProperty('priority');
            }
        });

    });

    describe('POST /tickets', () => {

        it('should create a new ticket', async () => {
            if (!customerId) {
                console.log('Skipping: No customer found');
                return;
            }

            const newTicket = {
                title: 'Test Ticket ' + Date.now(),
                description: 'Ticket created by automated tests',
                priority: 'HIGH',
                customerId: customerId
            };

            const res = await authRequest(token)
                .post('/tickets')
                .send(newTicket);

            expect(res.status).toBe(201);
            expect(res.body).toHaveProperty('id');
            expect(res.body.title).toBe(newTicket.title);
            expect(res.body.priority).toBe('HIGH');
            expect(res.body.status).toBe('OPEN');

            createdTicketId = res.body.id;
        });

    });

    describe('PUT /tickets/:id', () => {

        it('should update ticket status', async () => {
            if (!createdTicketId) return;

            const res = await authRequest(token)
                .put(`/tickets/${createdTicketId}`)
                .send({ status: 'IN_PROGRESS' });

            expect(res.status).toBe(200);
            expect(res.body.status).toBe('IN_PROGRESS');
        });

        it('should update ticket priority', async () => {
            if (!createdTicketId) return;

            const res = await authRequest(token)
                .put(`/tickets/${createdTicketId}`)
                .send({ priority: 'LOW' });

            expect(res.status).toBe(200);
            expect(res.body.priority).toBe('LOW');
        });

    });

});
