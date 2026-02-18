import request from 'supertest';
import express, { Express } from 'express';
import ticketsRouter from '../src/routes/tickets';

// Mock dependencies
// Note: In a real integration test, we might use a test database or mock Prisma.
// For "Basic Backend Tests", we'll mock the Prisma client responses to verify route logic.

jest.mock('../src/db', () => ({
    prisma: {
        ticket: {
            findMany: jest.fn().mockResolvedValue([
                { id: '1', title: 'Test Ticket', status: 'OPEN' }
            ]),
            findUnique: jest.fn().mockImplementation((args) => {
                if (args.where.id === '1') {
                    return Promise.resolve({ id: '1', title: 'Test Ticket' });
                }
                return Promise.resolve(null);
            }),
            create: jest.fn().mockResolvedValue({ id: '2', title: 'New Ticket', status: 'OPEN' }),
        },
    },
}));

jest.mock('../src/auth', () => ({
    authMiddleware: (req: any, res: any, next: any) => {
        req.user = { id: 'user1', organizationId: 'org1' };
        next();
    },
    requireRole: () => (req: any, res: any, next: any) => next(),
}));

jest.mock('../src/activity', () => ({
    logActivity: jest.fn(),
}));

const app: Express = express();
app.use(express.json());
app.use('/tickets', ticketsRouter);

describe('Tickets API', () => {
    it('GET /tickets should return a list of tickets', async () => {
        const res = await request(app).get('/tickets');
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body[0].title).toBe('Test Ticket');
    });

    it('GET /tickets/:id should return a specific ticket', async () => {
        const res = await request(app).get('/tickets/1');
        expect(res.status).toBe(200);
        expect(res.body.id).toBe('1');
    });

    it('GET /tickets/:id with invalid ID should return 404', async () => {
        const res = await request(app).get('/tickets/999');
        expect(res.status).toBe(404);
    });

    it('POST /tickets should create a new ticket', async () => {
        const newTicket = {
            title: 'New Ticket',
            clientId: 'client1',
            priority: 'HIGH'
        };
        const res = await request(app).post('/tickets').send(newTicket);
        expect(res.status).toBe(201);
        expect(res.body.title).toBe('New Ticket');
    });

    it('POST /tickets without required fields should fail', async () => {
        const res = await request(app).post('/tickets').send({});
        expect(res.status).toBe(400);
    });
});
