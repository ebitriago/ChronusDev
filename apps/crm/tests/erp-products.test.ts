/**
 * ERP Products API Tests
 * Tests for Product CRUD operations in Mini ERP
 */
import { getAuthToken, authRequest } from './setup';

describe('ERP Products API', () => {
    let token: string;
    let createdProductId: string;

    beforeAll(async () => {
        token = await getAuthToken();
    });

    describe('GET /erp/products', () => {

        it('should return list of products', async () => {
            const res = await authRequest(token).get('/erp/products');

            expect(res.status).toBe(200);
            expect(Array.isArray(res.body)).toBe(true);
        });

        it('should return products with required fields', async () => {
            const res = await authRequest(token).get('/erp/products');

            if (res.body.length > 0) {
                const product = res.body[0];
                expect(product).toHaveProperty('id');
                expect(product).toHaveProperty('name');
                expect(product).toHaveProperty('sku');
                expect(product).toHaveProperty('price');
                expect(product).toHaveProperty('stock');
            }
        });

    });

    describe('POST /erp/products', () => {

        it('should create a new product', async () => {
            const newProduct = {
                name: 'Test Product ' + Date.now(),
                sku: 'TEST-SKU-' + Date.now(),
                price: 99.99,
                stock: 50,
                description: 'Product created by automated tests'
            };

            const res = await authRequest(token)
                .post('/erp/products')
                .send(newProduct);

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('id');
            expect(res.body.name).toBe(newProduct.name);
            expect(res.body.sku).toBe(newProduct.sku);
            expect(res.body.price).toBe(newProduct.price);

            createdProductId = res.body.id;
        });

    });

    describe('PUT /erp/products/:id', () => {

        it('should update product with partial data', async () => {
            if (!createdProductId) return;

            const res = await authRequest(token)
                .put(`/erp/products/${createdProductId}`)
                .send({ name: 'Updated Product Name' });

            expect(res.status).toBe(200);
            expect(res.body.name).toBe('Updated Product Name');
            // Original price should be preserved
            expect(res.body.price).toBe(99.99);
        });

        it('should update only price without affecting other fields', async () => {
            if (!createdProductId) return;

            const res = await authRequest(token)
                .put(`/erp/products/${createdProductId}`)
                .send({ price: 149.99 });

            expect(res.status).toBe(200);
            expect(res.body.price).toBe(149.99);
            expect(res.body.name).toBe('Updated Product Name'); // Preserved from previous test
        });

    });

    describe('DELETE /erp/products/:id', () => {

        it('should delete product', async () => {
            if (!createdProductId) return;

            const res = await authRequest(token)
                .delete(`/erp/products/${createdProductId}`);

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('success', true);
        });

    });

});
