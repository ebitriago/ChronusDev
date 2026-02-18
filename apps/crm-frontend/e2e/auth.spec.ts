import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
    test('should allow user to login', async ({ page }) => {
        test.setTimeout(60000); // Allow more time for initial load

        // Debugging: Log console and network
        page.on('console', msg => console.log('PAGE LOG:', msg.text()));
        page.on('response', response => {
            if (response.url().includes('/auth/login') && response.request().method() === 'POST') {
                console.log('LOGIN RESPONSE STATUS:', response.status());
                response.text().then(t => console.log('LOGIN RESPONSE BODY:', t)).catch(() => { });
            }
        });

        const timestamp = Date.now();
        const email = `e2e_${timestamp}_${Math.floor(Math.random() * 10000)}@example.com`;
        const password = 'password123';

        const backendUrl = process.env.CRM_BACKEND_INTERNAL_URL || 'http://localhost:3002';
        console.log('Testing with Backend URL:', backendUrl);

        // Register user
        const regRes = await page.request.post(`${backendUrl}/auth/register`, {
            data: { email, password, name: 'E2E Test User' }
        });
        console.log('Registration Status:', regRes.status());
        if (!regRes.ok()) {
            console.log('Registration Error:', await regRes.text());
        }
        expect(regRes.ok()).toBeTruthy();

        // Navigate to login page
        await page.goto('/auth/login');
        // Wait for network to settle (helpful for slow dev starts)
        await page.waitForLoadState('domcontentloaded');

        // Fill login form using user-facing placeholders
        await page.getByPlaceholder('tu@email.com').fill(email);
        await page.getByPlaceholder('••••••••').fill(password);

        // Click login button
        await page.getByRole('button', { name: 'Iniciar Sesión' }).click();

        // Check for error message
        const errorMessage = page.locator('.text-red-400');
        if (await errorMessage.isVisible()) {
            console.log('Login Error Message:', await errorMessage.textContent());
        }

        // Expect to be redirected to dashboard
        await expect(page).toHaveURL('/');

        // Check for dashboard element
        await expect(page.getByText('Bienvenido de nuevo')).toBeVisible({ timeout: 10000 });
    });
});
