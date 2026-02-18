import request from 'supertest';
import { app } from '../src/index';
import { prisma } from '../src/db';

import { getAuthToken } from './setup';

describe('Lead Proposals API', () => {
    let token: string;
    let testLeadId: string;

    beforeAll(async () => {
        token = await getAuthToken();

        // Create a test lead
        const leadRes = await request(app)
            .post('/leads')
            .set('Authorization', `Bearer ${token}`)
            .send({
                name: 'Test Lead for Proposal',
                email: 'lead@test.com',
                phone: '123456789'
            });
        testLeadId = leadRes.body.id;
    });

    it('should create a quote (proposal) linked to a lead', async () => {
        const proposalData = {
            leadId: testLeadId,
            type: 'QUOTE',
            items: [{
                description: 'Consultoría CRM',
                quantity: 1,
                unitPrice: 500,
                total: 500
            }],
            dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        };

        const res = await request(app)
            .post('/invoices')
            .set('Authorization', `Bearer ${token}`)
            .send(proposalData);

        expect(res.status).toBe(201);
        expect(res.body.leadId).toBe(testLeadId);
        expect(res.body.type).toBe('QUOTE');
        expect(res.body.amount).toBe(500);
        expect(res.body.number).toMatch(/^QT-/);
    });

    it('should convert a quote to an invoice', async () => {
        // Get the quote we just created
        const quotes = await prisma.invoice.findMany({
            where: { leadId: testLeadId, type: 'QUOTE' }
        });
        const quoteId = (quotes[0] as any).id;

        const res = await request(app)
            .post(`/invoices/${quoteId}/convert`)
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.type).toBe('INVOICE');
        expect(res.body.number).toMatch(/^INV-/);
    });
});
