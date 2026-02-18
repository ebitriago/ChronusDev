import { Router } from 'express';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { fileURLToPath } from 'url';

const router = Router();

const _dirname = fileURLToPath(new URL('.', import.meta.url));
const packageJsonPath = join(_dirname, '../../package.json');

let version = '0.0.0';

// Async load version
(async () => {
    try {
        const data = await readFile(packageJsonPath, 'utf8');
        const json = JSON.parse(data);
        version = json.version;
    } catch (e) {
        console.error('Error reading package.json version', e);
    }
})();

/**
 * @openapi
 * /meta/version:
 *   get:
 *     tags: [Meta]
 *     summary: Get system version
 *     responses:
 *       200:
 *         description: System version info
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 version:
 *                   type: string
 *                   example: "1.0.0"
 */
router.get('/version', (req, res) => {
    res.json({ version });
});

export default router;
