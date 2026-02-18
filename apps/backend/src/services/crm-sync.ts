// CRM Sync Service - Synchronizes data from CRM to ChronusDev
import { prisma } from '../db.js';
import { logActivity } from '../activity.js';

const CRM_API_URL = process.env.CRM_API_URL || 'http://localhost:3002';
const CRM_SYNC_KEY = process.env.CRM_SYNC_KEY;

export async function syncClientFromCRM(customer: any, organizationId: string) {
    // First, try to find client in THIS organization
    let existing = await prisma.client.findFirst({
        where: {
            crmCustomerId: customer.id,
            organizationId: organizationId
        }
    });

    // If not found in this org, check if exists in another org (legacy data)
    if (!existing) {
        existing = await prisma.client.findFirst({
            where: { crmCustomerId: customer.id }
        });

        if (existing && existing.organizationId !== organizationId) {
            console.log(`[CRM Sync] Client ${customer.name} found in different org (${existing.organizationId}), moving to ${organizationId}`);
            // Do NOT set existing to null. We will update it.
        }
    }

    if (existing) {
        const updated = await prisma.client.update({
            where: { id: existing.id },
            data: {
                name: customer.name,
                email: customer.email,
                phone: customer.phone,
                contactName: customer.name,
                notes: customer.notes,
                organizationId: organizationId // Update org (Move client)
            }
        });

        await logActivity({
            type: 'UPDATED',
            description: `Cliente actualizado desde CRM: ${customer.name}`,
            organizationId,
            clientId: updated.id,
            metadata: { source: 'crm', crmCustomerId: customer.id, movedFrom: existing.organizationId !== organizationId ? existing.organizationId : undefined }
        });

        return updated;
    }

    const client = await prisma.client.create({
        data: {
            name: customer.name,
            email: customer.email || `${customer.id}@crm.local`, // Fallback if email missing
            phone: customer.phone,
            contactName: customer.name,
            notes: customer.notes,
            crmCustomerId: customer.id,
            organizationId
        }
    });

    console.log(`[CRM Sync] Created client ${customer.name} in org ${organizationId}`);

    await logActivity({
        type: 'CREATED',
        description: `Cliente sincronizado desde CRM: ${customer.name}`,
        organizationId,
        clientId: client.id,
        metadata: { source: 'crm', crmCustomerId: customer.id }
    });

    return client;
}

export async function syncUserFromCRM(crmUser: any, organizationId: string) {
    const existing = await prisma.user.findFirst({
        where: { crmUserId: crmUser.id }
    });

    if (existing) {
        return existing;
    }

    const role = mapRoleFromCRM(crmUser.role);

    const user = await prisma.user.create({
        data: {
            email: crmUser.email,
            name: crmUser.name,
            role: role as any,
            crmUserId: crmUser.id,
            memberships: {
                create: {
                    organizationId,
                    role: role as any,
                    defaultPayRate: 0
                }
            }
        }
    });

    return user;
}

function mapRoleFromCRM(role: string): string {
    const mapping: Record<string, string> = {
        'ADMIN': 'ADMIN',
        'AGENT': 'DEV',
        'MANAGER': 'MANAGER',
        'SUPER_ADMIN': 'SUPER_ADMIN',
        'DEV': 'DEV'
    };
    return mapping[role] || 'DEV';
}
