import { Router } from 'express';
import { prisma } from '../db.js';
import { authMiddleware } from '../auth.js';

const router = Router();

// ================= SEGMENTS =================

// GET /marketing/segments
router.get('/segments', authMiddleware, async (req: any, res) => {
    try {
        const organizationId = req.user.organizationId;
        const segments = await prisma.marketSegment.findMany({
            where: { organizationId },
            include: { _count: { select: { customers: true } } }
        });
        res.json(segments);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// POST /marketing/segments
router.post('/segments', authMiddleware, async (req: any, res) => {
    try {
        const { name, description, type, criteria } = req.body;
        const organizationId = req.user.organizationId;

        const segment = await prisma.marketSegment.create({
            data: {
                name,
                description,
                type,
                criteria: criteria || {},
                organizationId
            }
        });
        res.json(segment);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// POST /marketing/segments/:id/customers
// Add customers to static list
router.post('/segments/:id/customers', authMiddleware, async (req: any, res) => {
    try {
        const { id } = req.params;
        const { customerIds } = req.body; // Array of IDs

        if (!Array.isArray(customerIds)) return res.status(400).json({ error: "customerIds debe ser un array" });

        const segment = await prisma.marketSegment.update({
            where: { id },
            data: {
                customers: {
                    connect: customerIds.map((cid: string) => ({ id: cid }))
                }
            }
        });

        res.json(segment);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});


// ================= CAMPAIGNS =================

// GET /marketing/campaigns
router.get('/campaigns', authMiddleware, async (req: any, res) => {
    try {
        const organizationId = req.user.organizationId;
        const campaigns = await prisma.campaign.findMany({
            where: { organizationId },
            include: { segment: true },
            orderBy: { createdAt: 'desc' }
        });
        res.json(campaigns);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// POST /marketing/campaigns
router.post('/campaigns', authMiddleware, async (req: any, res) => {
    try {
        const { name, subject, content, segmentId } = req.body;
        const organizationId = req.user.organizationId;

        const campaign = await prisma.campaign.create({
            data: {
                name,
                subject,
                content,
                segmentId,
                organizationId,
                status: 'DRAFT'
            }
        });
        res.json(campaign);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// POST /marketing/campaigns/:id/send
// Simplified logic: Direct send (MVP) or create Job
router.post('/campaigns/:id/send', authMiddleware, async (req: any, res) => {
    try {
        const { id } = req.params;
        const campaign = await prisma.campaign.findUnique({
            where: { id },
            include: { segment: { include: { customers: true } } }
        });

        if (!campaign) return res.status(404).json({ error: "Campaña no encontrada" });
        if (!campaign.segment) return res.status(400).json({ error: "Campaña sin segmento asignado" });

        // Logic for STATIC segments (MVP)
        // For dynamic, we would query customers matching criteria.
        const recipients = campaign.segment.customers;

        if (recipients.length === 0) return res.status(400).json({ error: "El segmento está vacío" });

        // Create Job
        const job = await prisma.campaignJob.create({
            data: {
                campaignId: id,
                status: 'PENDING',
                totalCount: recipients.length
            }
        });

        // Trigger Async Processing (Fire and Forget)
        processCampaign(job.id, recipients);

        // Update Campaign Status
        await prisma.campaign.update({
            where: { id },
            data: { status: 'SENDING', totalRecipients: recipients.length }
        });

        res.json({ message: "Envío iniciado", jobId: job.id });

    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// Valid dummy function for now. Real implementation would use BullMQ or similar.
async function processCampaign(jobId: string, recipients: any[]) {
    // Simulate sending
    console.log(`[Campaign] Starting Job ${jobId} for ${recipients.length} recipients`);

    // In a real app, we would loop and send emails here.
    // implementing a delay to simulate work
    setTimeout(async () => {
        console.log(`[Campaign] Job ${jobId} finished`);
        await prisma.campaignJob.update({
            where: { id: jobId },
            data: { status: 'COMPLETED', processedCount: recipients.length }
        });
        // Update campaign status
        const job = await prisma.campaignJob.findUnique({ where: { id: jobId }, include: { campaign: true } });
        if (job) {
            await prisma.campaign.update({
                where: { id: job.campaignId },
                data: { status: 'SENT', sentCount: recipients.length, sentAt: new Date() }
            });
        }
    }, 5000);
}

export default router;
