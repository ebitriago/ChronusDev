// Organizations routes
import { Router } from 'express';
import { prisma } from '../db.js';
import { authMiddleware, requireRole, switchOrganization } from '../auth.js';

const router = Router();

// GET /organizations/:id/public - Public endpoint for cross-system lookup (no auth)
router.get('/:id/public', async (req, res) => {
    try {
        const { id } = req.params;
        const org = await prisma.organization.findUnique({
            where: { id },
            select: { id: true, name: true, crmOrganizationId: true }
        });

        if (!org) {
            return res.status(404).json({ error: 'Organización no encontrada' });
        }

        res.json({ id: org.id, name: org.name, crmOrganizationId: org.crmOrganizationId });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// GET /organizations/by-crm/:crmOrgId - Check if any ChronusDev org is linked to this CRM org
router.get('/by-crm/:crmOrgId', async (req, res) => {
    try {
        const { crmOrgId } = req.params;

        // Find any ChronusDev org that has this CRM org ID linked
        const org = await prisma.organization.findFirst({
            where: { crmOrganizationId: crmOrgId },
            select: { id: true, name: true }
        });

        if (org) {
            res.json({ linked: true, devOrgId: org.id, devOrgName: org.name, crmOrgId });
        } else {
            res.json({ linked: false, crmOrgId });
        }
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// GET /organizations/current - Obtener organización actual
router.get('/current', authMiddleware, async (req: any, res) => {
    try {
        const organizationId = req.user?.organizationId;
        if (!organizationId) {
            return res.status(401).json({ error: 'No organization context' });
        }

        const organization = await prisma.organization.findUnique({
            where: { id: organizationId },
            include: {
                _count: {
                    select: {
                        members: true,
                        projects: true,
                        clients: true
                    }
                }
            }
        });

        if (!organization) {
            return res.status(404).json({ error: 'Organización no encontrada' });
        }

        res.json(organization);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// GET /organizations/mine - Obtener todas las organizaciones del usuario
router.get('/mine', authMiddleware, async (req: any, res) => {
    try {
        const userId = req.user.id;

        const memberships = await prisma.organizationMember.findMany({
            where: { userId },
            include: {
                organization: {
                    include: {
                        _count: {
                            select: {
                                members: true,
                                projects: true
                            }
                        }
                    }
                }
            }
        });

        const organizations = memberships.map((m: any) => ({
            id: m.organization.id,
            name: m.organization.name,
            slug: m.organization.slug,
            role: m.role,
            enabledServices: m.organization.enabledServices,
            plan: m.organization.plan,
            subscriptionStatus: m.organization.subscriptionStatus,
            memberCount: m.organization._count.members,
            projectCount: m.organization._count.projects,
            isCurrent: m.organization.id === req.user.organizationId
        }));

        res.json(organizations);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// POST /organizations/switch - Cambiar organización activa
router.post('/switch', authMiddleware, async (req: any, res) => {
    try {
        const { organizationId } = req.body;

        if (!organizationId) {
            return res.status(400).json({ error: 'organizationId requerido' });
        }

        const result = await switchOrganization(req.user.id, organizationId);

        if (result.error) {
            return res.status(400).json(result);
        }

        res.json(result);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// PUT /organizations/current - Actualizar organización actual (solo ADMIN)
router.put('/current', authMiddleware, requireRole('ADMIN'), async (req: any, res) => {
    try {
        const organizationId = req.user?.organizationId;
        const { name, enabledServices } = req.body;

        if (!organizationId) {
            return res.status(401).json({ error: 'No organization context' });
        }

        const updateData: any = {};
        if (name) updateData.name = name;
        if (enabledServices) updateData.enabledServices = enabledServices;

        const updated = await prisma.organization.update({
            where: { id: organizationId },
            data: updateData
        });

        res.json(updated);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// POST /organizations/current/link-crm - Vincular con organización de CRM
router.post('/current/link-crm', authMiddleware, requireRole('ADMIN'), async (req: any, res) => {
    try {
        const organizationId = req.user?.organizationId;
        const { crmOrganizationId } = req.body;

        if (!organizationId) {
            return res.status(401).json({ error: 'No organization context' });
        }

        if (!crmOrganizationId) {
            return res.status(400).json({ error: 'crmOrganizationId requerido' });
        }

        // Check if already linked to another org
        const existing = await prisma.organization.findFirst({
            where: {
                crmOrganizationId,
                NOT: { id: organizationId }
            }
        });

        if (existing) {
            return res.status(400).json({
                error: 'Esta organización de CRM ya está vinculada a otra organización de ChronusDev'
            });
        }

        const updated = await prisma.organization.update({
            where: { id: organizationId },
            data: { crmOrganizationId }
        });

        console.log(`[CRM Link] Organization ${organizationId} linked to CRM org ${crmOrganizationId}`);

        res.json({
            success: true,
            message: 'Organización vinculada con CRM exitosamente',
            organization: updated
        });
    } catch (error: any) {
        console.error('POST /organizations/current/link-crm error:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /organizations/current/crm-link - Verificar estado de vinculación con CRM
router.get('/current/crm-link', authMiddleware, async (req: any, res) => {
    try {
        const organizationId = req.user?.organizationId;

        if (!organizationId) {
            return res.status(401).json({ error: 'No organization context' });
        }

        const organization = await prisma.organization.findUnique({
            where: { id: organizationId },
            select: {
                id: true,
                name: true,
                crmOrganizationId: true
            }
        });

        if (!organization) {
            return res.status(404).json({ error: 'Organización no encontrada' });
        }

        res.json({
            linked: !!organization.crmOrganizationId,
            crmOrganizationId: organization.crmOrganizationId,
            organizationId: organization.id,
            organizationName: organization.name
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE /organizations/current/link-crm - Desvincular CRM
router.delete('/current/link-crm', authMiddleware, requireRole('ADMIN'), async (req: any, res) => {
    try {
        const organizationId = req.user?.organizationId;

        if (!organizationId) {
            return res.status(401).json({ error: 'No organization context' });
        }

        await prisma.organization.update({
            where: { id: organizationId },
            data: { crmOrganizationId: null }
        });

        res.json({ success: true, message: 'Vinculación con CRM eliminada' });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
