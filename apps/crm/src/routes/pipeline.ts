
import { Router } from 'express';
import { prisma } from '../db.js';
import { authMiddleware } from '../auth.js';

const router = Router();

// Default stages if none exist
const DEFAULT_STAGES = [
    { name: 'Nuevo', color: 'bg-blue-50 text-blue-700 border-blue-100', isDefault: true, order: 0 },
    { name: 'Contactado', color: 'bg-indigo-50 text-indigo-700 border-indigo-100', isDefault: false, order: 1 },
    { name: 'Calificado', color: 'bg-amber-50 text-amber-700 border-amber-100', isDefault: false, order: 2 },
    { name: 'Negociación', color: 'bg-purple-50 text-purple-700 border-purple-100', isDefault: false, order: 3 },
    { name: 'Ganado', color: 'bg-emerald-50 text-emerald-700 border-emerald-100', isDefault: true, order: 4 },
    { name: 'Perdido', color: 'bg-gray-50 text-gray-500 border-gray-100', isDefault: true, order: 5 },
];

// GET /pipeline-stages
router.get('/', authMiddleware, async (req: any, res) => {
    try {
        const organizationId = req.user?.organizationId;
        if (!organizationId) return res.status(401).json({ error: 'No organization context' });

        let stages = await prisma.pipelineStage.findMany({
            where: { organizationId },
            include: { automations: true }, // Include automations
            orderBy: { order: 'asc' }
        });

        // Initialize with defaults if empty
        if (stages.length === 0) {
            console.log(`[Pipeline] Initializing default stages for org ${organizationId}`);
            // Create defaults
            await prisma.$transaction(
                DEFAULT_STAGES.map(stage =>
                    prisma.pipelineStage.create({
                        data: {
                            ...stage,
                            organizationId
                        }
                    })
                )
            );

            stages = await prisma.pipelineStage.findMany({
                where: { organizationId },
                include: { automations: true },
                orderBy: { order: 'asc' }
            });
        }

        res.json(stages);
    } catch (error: any) {
        console.error('GET /pipeline-stages error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ... (existing routes Reorder, Create, Put) ...

// ==================== AUTOMATIONS ====================

// POST /pipeline-stages/:stageId/automations
router.post('/:stageId/automations', authMiddleware, async (req: any, res) => {
    try {
        const organizationId = req.user?.organizationId;
        const { stageId } = req.params;
        const { actionType, delayMinutes, config } = req.body;

        const stage = await prisma.pipelineStage.findUnique({ where: { id: stageId } });
        if (!stage || stage.organizationId !== organizationId) return res.status(404).json({ error: 'Stage not found' });

        const automation = await prisma.pipelineAutomation.create({
            data: {
                stageId,
                trigger: 'ENTER_STAGE',
                actionType,
                delayMinutes: delayMinutes || 0,
                config,
                isEnabled: true
            }
        });

        res.json(automation);
    } catch (error: any) {
        console.error('POST /automations error:', error);
        res.status(500).json({ error: error.message });
    }
});

// DELETE /pipeline-stages/automations/:id
router.delete('/automations/:id', authMiddleware, async (req: any, res) => {
    try {
        const organizationId = req.user?.organizationId;
        const { id } = req.params;

        const automation = await prisma.pipelineAutomation.findUnique({
            where: { id },
            include: { stage: true }
        });

        if (!automation || automation.stage.organizationId !== organizationId) {
            return res.status(404).json({ error: 'Automation not found' });
        }

        await prisma.pipelineAutomation.delete({ where: { id } });
        res.json({ success: true });
    } catch (error: any) {
        console.error('DELETE /automations error:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /pipeline-stages/reorder (Update Order)
router.post('/reorder', authMiddleware, async (req: any, res) => {
    try {
        const organizationId = req.user?.organizationId;
        const { stageIds } = req.body; // Array of IDs in new order

        if (!Array.isArray(stageIds)) return res.status(400).json({ error: 'stageIds array required' });

        await prisma.$transaction(
            stageIds.map((id, index) =>
                prisma.pipelineStage.update({
                    where: { id, organizationId }, // Ensure ownership
                    data: { order: index }
                })
            )
        );

        res.json({ success: true });

    } catch (error: any) {
        console.error('POST /pipeline-stages/reorder error:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /pipeline-stages (Create Single)
router.post('/', authMiddleware, async (req: any, res) => {
    try {
        const organizationId = req.user?.organizationId;
        if (!organizationId) return res.status(401).json({ error: 'No organization context' });

        const { name, color, order } = req.body;
        if (!name) return res.status(400).json({ error: 'Name is required' });

        const newStage = await prisma.pipelineStage.create({
            data: {
                name,
                color: color || 'bg-gray-100',
                order: order ?? 99,
                organizationId,
                isDefault: false
            }
        });

        res.json(newStage);

    } catch (error: any) {
        console.error('POST /pipeline-stages error:', error);
        res.status(500).json({ error: error.message });
    }
});

// PUT /pipeline-stages/:id (Update Single)
router.put('/:id', authMiddleware, async (req: any, res) => {
    try {
        const organizationId = req.user?.organizationId;
        const { id } = req.params;
        const { name, color, order } = req.body;

        const stage = await prisma.pipelineStage.findUnique({ where: { id } });
        if (!stage || stage.organizationId !== organizationId) {
            return res.status(404).json({ error: 'Stage not found' });
        }

        const updatedStage = await prisma.pipelineStage.update({
            where: { id },
            data: {
                name,
                color,
                order
            }
        });

        res.json(updatedStage);

    } catch (error: any) {
        console.error('PUT /pipeline-stages/:id error:', error);
        res.status(500).json({ error: error.message });
    }
});

// DELETE /pipeline-stages/:id
router.delete('/:id', authMiddleware, async (req: any, res) => {
    try {
        const organizationId = req.user?.organizationId;
        const { id } = req.params;

        const stage = await prisma.pipelineStage.findUnique({ where: { id } });

        if (!stage || stage.organizationId !== organizationId) {
            return res.status(404).json({ error: 'Stage not found' });
        }

        if (stage.isDefault) {
            return res.status(400).json({ error: 'Cannot delete default stages' });
        }

        // Check if there are leads in this stage
        const leadsCount = await prisma.lead.count({ where: { organizationId, status: stage.name } });

        if (leadsCount > 0) {
            // Find default stage to move leads to
            const defaultStage = await prisma.pipelineStage.findFirst({
                where: { organizationId, order: 0 } // Assuming order 0 is always the default "Nuevo"/"New"
            });

            if (!defaultStage) {
                return res.status(500).json({ error: 'Cannot move leads: No default stage found (order 0)' });
            }

            // Move leads
            await prisma.lead.updateMany({
                where: { organizationId, status: stage.name },
                data: { status: defaultStage.name }
            });

            console.log(`[Pipeline] Moved ${leadsCount} leads from deleted stage "${stage.name}" to "${defaultStage.name}"`);
        }

        await prisma.pipelineStage.delete({ where: { id } });
        res.json({ success: true, movedLeads: leadsCount });

    } catch (error: any) {
        console.error('DELETE /pipeline-stages error:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
