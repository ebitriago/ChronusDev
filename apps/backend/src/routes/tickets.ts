import { Router } from 'express';
import { prisma } from '../db.js';
import { authMiddleware, requireRole } from '../auth.js';
import { logActivity } from '../activity.js';

const router = Router();

// GET /tickets
/**
 * @openapi
 * /tickets:
 *   get:
 *     summary: Obtener todos los tickets de la organización
 *     tags: [Tickets]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de tickets
 */
router.get('/', authMiddleware, async (req: any, res) => {
    try {
        const organizationId = req.user.organizationId;
        const tickets = await prisma.ticket.findMany({
            where: { organizationId },
            include: {
                client: true,
                assignedTo: {
                    select: { id: true, name: true, email: true, avatar: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json(tickets);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * @openapi
 * /tickets/{id}:
 *   get:
 *     summary: Obtener un ticket por ID
 *     tags: [Tickets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Detalle del ticket
 *       404:
 *         description: Ticket no encontrado
 */
router.get('/:id', authMiddleware, async (req: any, res) => {
    try {
        const { id } = req.params;
        const ticket = await prisma.ticket.findUnique({
            where: { id },
            include: {
                client: true,
                assignedTo: {
                    select: { id: true, name: true, email: true, avatar: true }
                }
            }
        });

        if (!ticket) return res.status(404).json({ error: 'Ticket no encontrado' });
        res.json(ticket);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// GET /tickets

/**
 * @openapi
 * /tickets:
 *   post:
 *     summary: Crear un nuevo ticket
 *     tags: [Tickets]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, clientId]
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               clientId:
 *                 type: string
 *               priority:
 *                 type: string
 *                 enum: [LOW, MEDIUM, HIGH, URGENT]
 *               assignedToId:
 *                 type: string
 *     responses:
 *       201:
 *         description: Ticket creado
 */
router.post('/', authMiddleware, async (req: any, res) => {
    try {
        const organizationId = req.user.organizationId;
        const { title, description, clientId, priority, assignedToId } = req.body;

        if (!title || !clientId) {
            return res.status(400).json({ error: 'Title and Client are required' });
        }

        const ticket = await prisma.ticket.create({
            data: {
                organizationId,
                title,
                description,
                clientId,
                priority: priority || 'MEDIUM',
                assignedToId,
                status: 'OPEN'
            }
        });

        await logActivity({
            type: 'CREATED', // Map generically
            description: `Ticket creado: ${title}`,
            organizationId,
            userId: req.user.id,
            clientId,
            metadata: {
                ticketId: ticket.id,
                priority
            }
        });

        res.status(201).json(ticket);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
