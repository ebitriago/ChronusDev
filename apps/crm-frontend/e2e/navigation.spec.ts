import { test, expect } from '@playwright/test';

test.describe('Navigation Flow', () => {
    test.beforeEach(async ({ page }) => {
        test.setTimeout(60000);

        const timestamp = Date.now();
        const email = `e2e_nav_${timestamp}_${Math.floor(Math.random() * 10000)}@example.com`;
        const password = 'password123';
        const backendUrl = process.env.CRM_BACKEND_INTERNAL_URL || 'http://localhost:3002';

        // Register user
        await page.request.post(`${backendUrl}/auth/register`, {
            data: { email, password, name: 'Nav User' }
        });

        // Mock authentication or perform login
        await page.goto('/auth/login');
        await page.waitForLoadState('domcontentloaded');

        await page.getByPlaceholder('tu@email.com').fill(email);
        await page.getByPlaceholder('••••••••').fill(password);
        await page.getByRole('button', { name: 'Iniciar Sesión' }).click();

        await expect(page).toHaveURL('/');
        // Wait for dashboard to load
        await expect(page.getByText('Bienvenido de nuevo')).toBeVisible({ timeout: 10000 });
    });

    test('should navigate to Client section', async ({ page }) => {
        // Find link to clients
        await page.click('div:text("Gestión de Clientes")'); // Using Sidebar text or icon

        // Check if Clients page is loaded (updates header)
        await expect(page.locator('h1')).toContainText('Gestión de Clientes');
    });

    test('should navigate to Dashboard', async ({ page }) => {
        // If we are not at root
        await page.click('div:text("Gestión de Clientes")');

        // Navigate back to Dashboard/Inbox
        await page.click('div:text("Dashboard")');

        await expect(page.locator('h1')).toContainText('Bienvenido de nuevo');
    });
});
