import request from 'supertest';
import { app } from '../src/index';

import { getAuthToken } from './setup';

describe('CSV Export API', () => {
    let token: string;

    beforeAll(async () => {
        token = await getAuthToken();
    });

    it('should export invoices as CSV', async () => {
        const res = await request(app)
            .get('/reports/export/invoices-csv')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.header['content-type']).toContain('text/csv');
        expect(res.header['content-disposition']).toContain('attachment; filename="invoices.csv"');
        expect(res.text).toContain('ID,Number,Customer,Amount,Currency,Status,Date');
    });

    it('should export transactions as CSV', async () => {
        const res = await request(app)
            .get('/reports/export/transactions-csv')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.header['content-type']).toContain('text/csv');
        expect(res.header['content-disposition']).toContain('attachment; filename="transactions.csv"');
        expect(res.text).toContain('ID,Date,Description,Category,Type,Amount,Customer');
    });
});
