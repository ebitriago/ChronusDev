/**
 * AssistAI Webhook Tests
 * Tests for ORDER_CREATED webhook handling and auto-creation logic
 */
import request from 'supertest';
import { app, getAuthToken, authRequest } from './setup';

describe('AssistAI Webhook API', () => {
    let token: string;
    let orgSlug: string;

    beforeAll(async () => {
        token = await getAuthToken();
        const { prisma } = await import('../src/db');
        const user = await prisma.user.findUnique({
            where: { email: 'admin@chronus.com' },
            include: { memberships: { include: { organization: true } } }
        });
        orgSlug = user?.memberships[0]?.organization?.slug || 'chronus';
    });

    describe('POST /assistai/webhook', () => {

        it('should accept ORDER_CREATED event', async () => {
            const payload = {
                organizationCode: orgSlug,
                agentCode: 'TEST_AGENT',
                customer: {
                    name: 'Webhook Test Customer',
                    phone: '5559999999'
                },
                cart: {
                    total: 199.99,
                    items: [
                        {
                            sku: 'WEBHOOK-TEST-SKU-' + Date.now(),
                            name: 'Webhook Test Product',
                            price: 199.99,
                            quantity: 1
                        }
                    ]
                }
            };

            const res = await request(app)
                .post('/assistai/webhook')
                .set('x-assistai-event', 'ORDER_CREATED')
                .set('Content-Type', 'application/json')
                .send(payload);

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('received', true);
        });

        it('should auto-create product if SKU not found', async () => {
            const uniqueSku = 'AUTO-CREATE-' + Date.now();

            const payload = {
                organizationCode: orgSlug,
                agentCode: 'TEST_AGENT',
                customer: {
                    name: 'Auto Create Test',
                    phone: '5551111111'
                },
                cart: {
                    total: 99.99,
                    items: [
                        {
                            sku: uniqueSku,
                            name: 'Auto Created Product by Webhook',
                            price: 99.99,
                            quantity: 1
                        }
                    ]
                }
            };

            // Send webhook
            await request(app)
                .post('/assistai/webhook')
                .set('x-assistai-event', 'ORDER_CREATED')
                .send(payload);

            // Wait for async processing
            await new Promise(r => setTimeout(r, 500));

            // Verify product was created
            const productsRes = await authRequest(token).get('/erp/products');
            const autoProduct = productsRes.body.find((p: any) => p.sku === uniqueSku);

            expect(autoProduct).toBeDefined();
            expect(autoProduct.name).toBe('Auto Created Product by Webhook');
        });

        it('should create new customer if phone not found', async () => {
            const uniquePhone = '555000' + Date.now().toString().slice(-4);

            const payload = {
                organizationCode: orgSlug,
                agentCode: 'TEST_AGENT',
                customer: {
                    name: 'New Customer From Webhook',
                    phone: uniquePhone
                },
                cart: {
                    total: 50,
                    items: [
                        {
                            sku: 'EXISTING-SKU-OR-CREATE',
                            name: 'Test Product',
                            price: 50,
                            quantity: 1
                        }
                    ]
                }
            };

            await request(app)
                .post('/assistai/webhook')
                .set('x-assistai-event', 'ORDER_CREATED')
                .send(payload);

            // Wait for async processing
            await new Promise(r => setTimeout(r, 500));

            // Verify customer was created
            const customersRes = await authRequest(token).get('/customers');
            const newCustomer = customersRes.body.find((c: any) => c.phone === uniquePhone);

            expect(newCustomer).toBeDefined();
            expect(newCustomer.name).toBe('New Customer From Webhook');
        });

    });

});
