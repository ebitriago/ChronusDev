// Clients routes
import { Router } from 'express';
import { prisma } from '../db.js';
import { authMiddleware, requireRole } from '../auth.js';
import { logActivity } from '../activity.js';
import { syncClientFromCRM } from '../services/crm-sync.js';

const router = Router();

const CRM_API_URL = process.env.CRM_API_URL ||
    (process.env.NODE_ENV === 'development' ? 'http://localhost:3002' : 'https://chronuscrm.assistai.work');

router.get('/ping', (req, res) => res.json({ message: 'pong' }));

// POST /clients/sync-from-crm - Sincronizar clientes desde CRM vinculado
router.post('/sync-from-crm', authMiddleware, requireRole('ADMIN', 'MANAGER'), async (req: any, res) => {
    try {
        const organizationId = req.user?.organizationId;
        if (!organizationId) {
            return res.status(401).json({ error: 'No organization context' });
        }

        // Check if organization is linked to CRM
        const org = await prisma.organization.findUnique({
            where: { id: organizationId }
        });

        if (!org?.crmOrganizationId) {
            return res.status(400).json({
                error: 'Tu organización no está vinculada a un CRM. Ve a Configuración para vincular.'
            });
        }

        // Fetch customers from CRM 
        const crmResponse = await fetch(`${CRM_API_URL}/customers/for-chronusdev?organizationId=${org.crmOrganizationId}`, {
            headers: {
                'Content-Type': 'application/json',
                'X-Sync-Key': process.env.CRM_SYNC_KEY || 'chronus-sync-key'
            }
        });

        if (!crmResponse.ok) {
            console.error('CRM API error:', await crmResponse.text());
            return res.status(502).json({ error: 'Error conectando con CRM' });
        }

        const customers = await crmResponse.json();

        if (!Array.isArray(customers)) {
            return res.status(502).json({ error: 'Respuesta inválida del CRM' });
        }

        // Sync each customer
        const synced = [];
        const failed = [];

        for (const customer of customers) {
            try {
                const client = await syncClientFromCRM(customer, organizationId);
                synced.push(client);
            } catch (err: any) {
                console.error(`Error syncing customer ${customer.id}:`, err.message);
                failed.push({
                    name: customer.name,
                    reason: err.message
                });
            }
        }

        res.json({
            success: true,
            message: `${synced.length} clientes sincronizados. ${failed.length} fallos.`,
            clients: synced,
            failed
        });
    } catch (error: any) {
        console.error('POST /clients/sync-from-crm error:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /clients - Listar clientes
router.get('/', authMiddleware, async (req: any, res) => {
    try {
        const organizationId = req.user?.organizationId;
        if (!organizationId) {
            return res.status(401).json({ error: 'No organization context' });
        }

        const clients = await prisma.client.findMany({
            where: { organizationId },
            include: {
                projects: {
                    where: { status: 'ACTIVE' },
                    select: { id: true, name: true, status: true }
                },
                _count: {
                    select: { projects: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json(clients);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// GET /clients/:id - Obtener cliente
router.get('/:id', authMiddleware, async (req: any, res) => {
    try {
        const organizationId = req.user?.organizationId;
        const client = await prisma.client.findFirst({
            where: {
                id: req.params.id,
                organizationId
            },
            include: {
                projects: {
                    include: {
                        _count: {
                            select: { tasks: true, timeLogs: true }
                        }
                    }
                },
                attachments: {
                    orderBy: { createdAt: 'desc' }
                }
            }
        });

        if (!client) {
            return res.status(404).json({ error: 'Cliente no encontrado' });
        }

        res.json(client);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// POST /clients - Crear cliente
router.post('/', authMiddleware, requireRole('ADMIN', 'MANAGER'), async (req: any, res) => {
    try {
        const organizationId = req.user?.organizationId;
        const { name, email, phone, contactName, notes } = req.body;

        if (!name || !email) {
            return res.status(400).json({ error: 'name y email requeridos' });
        }

        const client = await prisma.client.create({
            data: {
                name,
                email,
                phone,
                contactName,
                notes,
                organizationId
            }
        });

        await logActivity({
            type: 'CREATED',
            description: `Cliente creado: ${name}`,
            organizationId,
            clientId: client.id,
            userId: req.user.id
        });

        res.status(201).json(client);
    } catch (error: any) {
        if (error.code === 'P2002') {
            return res.status(400).json({ error: 'El email ya está registrado' });
        }
        res.status(500).json({ error: error.message });
    }
});

// PUT /clients/:id - Actualizar cliente
router.put('/:id', authMiddleware, requireRole('ADMIN', 'MANAGER'), async (req: any, res) => {
    try {
        const organizationId = req.user?.organizationId;
        const { name, email, phone, contactName, notes } = req.body;

        const client = await prisma.client.findFirst({
            where: {
                id: req.params.id,
                organizationId
            }
        });

        if (!client) {
            return res.status(404).json({ error: 'Cliente no encontrado' });
        }

        const updated = await prisma.client.update({
            where: { id: req.params.id },
            data: {
                ...(name && { name }),
                ...(email && { email }),
                ...(phone !== undefined && { phone }),
                ...(contactName !== undefined && { contactName }),
                ...(notes !== undefined && { notes })
            }
        });

        await logActivity({
            type: 'UPDATED',
            description: `Cliente actualizado: ${updated.name}`,
            organizationId,
            clientId: updated.id,
            userId: req.user.id
        });

        res.json(updated);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE /clients/:id - Eliminar cliente
router.delete('/:id', authMiddleware, requireRole('ADMIN'), async (req: any, res) => {
    try {
        const organizationId = req.user?.organizationId;
        const client = await prisma.client.findFirst({
            where: {
                id: req.params.id,
                organizationId
            }
        });

        if (!client) {
            return res.status(404).json({ error: 'Cliente no encontrado' });
        }

        await prisma.client.delete({
            where: { id: req.params.id }
        });

        await logActivity({
            type: 'DELETED',
            description: `Cliente eliminado: ${client.name}`,
            organizationId,
            userId: req.user.id
        });

        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});


// POST /clients/:id/attachments - Agregar archivo adjunto
router.post('/:id/attachments', authMiddleware, requireRole('ADMIN', 'MANAGER'), async (req: any, res) => {
    try {
        const organizationId = req.user?.organizationId;
        const { name, url, type, size } = req.body;

        const client = await prisma.client.findFirst({
            where: {
                id: req.params.id,
                organizationId
            }
        });

        if (!client) {
            return res.status(404).json({ error: 'Cliente no encontrado' });
        }

        const attachment = await prisma.clientAttachment.create({
            data: {
                clientId: client.id,
                name,
                url,
                type,
                size
            }
        });

        await logActivity({
            type: 'UPDATED',
            description: `Archivo adjunto agregado a cliente ${client.name}: ${name}`,
            organizationId,
            clientId: client.id,
            userId: req.user.id
        });

        res.status(201).json(attachment);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE /clients/:id/attachments/:attachmentId - Eliminar archivo adjunto
router.delete('/:id/attachments/:attachmentId', authMiddleware, requireRole('ADMIN', 'MANAGER'), async (req: any, res) => {
    try {
        const organizationId = req.user?.organizationId;
        const { id, attachmentId } = req.params;

        const client = await prisma.client.findFirst({
            where: {
                id,
                organizationId
            }
        });

        if (!client) {
            return res.status(404).json({ error: 'Cliente no encontrado' });
        }

        await prisma.clientAttachment.delete({
            where: { id: attachmentId }
        });

        await logActivity({
            type: 'UPDATED',
            description: `Archivo adjunto eliminado de cliente ${client.name}`,
            organizationId,
            clientId: client.id,
            userId: req.user.id
        });

        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
