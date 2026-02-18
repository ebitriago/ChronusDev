/**
 * ERP Orders API Tests
 * Tests for Order operations in Mini ERP
 */
import { getAuthToken, authRequest } from './setup';

describe('ERP Orders API', () => {
    let token: string;

    beforeAll(async () => {
        token = await getAuthToken();
    });

    describe('GET /erp/orders', () => {

        it('should return list of orders', async () => {
            const res = await authRequest(token).get('/erp/orders');

            expect(res.status).toBe(200);
            expect(Array.isArray(res.body)).toBe(true);
        });

        it('should return orders with customer info', async () => {
            const res = await authRequest(token).get('/erp/orders');

            if (res.body.length > 0) {
                const order = res.body[0];
                expect(order).toHaveProperty('id');
                expect(order).toHaveProperty('total');
                expect(order).toHaveProperty('status');
                expect(order).toHaveProperty('customer');
            }
        });

    });

    describe('GET /erp/orders/:id', () => {

        it('should return order details with items', async () => {
            // First get list to find an order ID
            const listRes = await authRequest(token).get('/erp/orders');

            if (listRes.body.length > 0) {
                const orderId = listRes.body[0].id;
                const res = await authRequest(token).get(`/erp/orders/${orderId}`);

                expect(res.status).toBe(200);
                expect(res.body).toHaveProperty('id', orderId);
                expect(res.body).toHaveProperty('items');
                expect(Array.isArray(res.body.items)).toBe(true);
            }
        });

    });

    describe('PUT /erp/orders/:id', () => {

        it('should update order status', async () => {
            const listRes = await authRequest(token).get('/erp/orders');

            if (listRes.body.length > 0) {
                const orderId = listRes.body[0].id;
                const res = await authRequest(token)
                    .put(`/erp/orders/${orderId}`)
                    .send({ status: 'COMPLETED' });

                expect(res.status).toBe(200);
                expect(res.body.status).toBe('COMPLETED');
            }
        });

    });

});
