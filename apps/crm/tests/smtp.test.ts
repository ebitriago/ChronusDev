import request from 'supertest';
import { app } from '../src/index';

import { getAuthToken } from './setup';

describe('SMTP Configuration API', () => {
    let token: string;

    beforeAll(async () => {
        token = await getAuthToken();
    });

    it('should save SMTP configuration', async () => {
        const smtpConfig = {
            host: 'smtp.test.com',
            port: 587,
            user: 'test-user',
            pass: 'test-pass',
            from: 'test@chronuscrm.com'
        };

        const res = await request(app)
            .post('/settings/smtp')
            .set('Authorization', `Bearer ${token}`)
            .send(smtpConfig);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });

    it('should retrieve SMTP configuration', async () => {
        const res = await request(app)
            .get('/settings/smtp')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.host).toBe('smtp.test.com');
        expect(res.body.user).toBe('test-user');
    });
});
