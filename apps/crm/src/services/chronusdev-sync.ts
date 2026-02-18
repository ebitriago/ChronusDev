/**
 * ChronusDev Sync Service
 * 
 * Handles automatic synchronization between CRM and ChronusDev:
 * - Customers → Clients
 * - Tickets → Tasks
 * - Auto-creation of default "Soporte" projects
 */

import { prisma } from '../db.js';


const CHRONUSDEV_URL = process.env.CHRONUSDEV_API_URL ||
    (process.env.NODE_ENV === 'development' ? "http://localhost:3001" : "https://chronusdev.assistai.work/api");
const SYNC_KEY = process.env.CRM_SYNC_KEY || "dev-sync-key";

interface Customer {
    id: string;
    organizationId: string;
    name: string;
    email: string;
    phone?: string | null;
    company?: string | null;
    notes?: string | null;
    chronusDevClientId?: string | null;
    chronusDevDefaultProjectId?: string | null;
}

/**
 * Synchronizes a CRM customer to ChronusDev as a client via Webhook
 */
export async function syncCustomerToChronusDev(
    customer: Customer,
    organizationId: string
): Promise<{ clientId: string }> {
    console.log(`[Sync] Syncing customer ${customer.id} to ChronusDev via webhook`);

    try {
        const response = await fetch(`${CHRONUSDEV_URL}/webhooks/crm/customer-created`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Sync-Key": SYNC_KEY,
            },
            body: JSON.stringify({
                customer: {
                    id: customer.id,
                    name: customer.name,
                    email: customer.email,
                    phone: customer.phone,
                    company: customer.company,
                    notes: customer.notes
                },
                organizationId
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to sync client to ChronusDev: ${errorText}`);
        }

        const result = await response.json();
        const clientId = result.clientId;

        // Update customer with ChronusDev client ID
        await prisma.customer.update({
            where: { id: customer.id },
            data: { chronusDevClientId: clientId }
        });

        console.log(`[Sync] Successfully synced customer ${customer.id} -> Client ${clientId}`);
        return { clientId };
    } catch (error) {
        console.error(`[Sync] Error syncing customer ${customer.id}:`, error);
        throw error;
    }
}

/**
 * Updates an existing ChronusDev client with customer data via Webhook
 */
export async function updateChronusDevClient(customer: Customer): Promise<void> {
    if (!customer.chronusDevClientId) {
        console.warn('[Sync] Customer does not have a chronusDevClientId, skipping update sync');
        return;
    }

    try {
        const response = await fetch(`${CHRONUSDEV_URL}/webhooks/crm/customer-updated`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Sync-Key": SYNC_KEY,
            },
            body: JSON.stringify({
                customer: {
                    id: customer.id,
                    name: customer.name,
                    email: customer.email,
                    phone: customer.phone,
                    company: customer.company,
                    notes: customer.notes
                },
                organizationId: customer.organizationId
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to update client in ChronusDev: ${errorText}`);
        }

        console.log(`[Sync] Updated ChronusDev client ${customer.chronusDevClientId}`);
    } catch (error) {
        console.error(`[Sync] Error updating ChronusDev client ${customer.chronusDevClientId}:`, error);
        throw error;
    }
}

interface Ticket {
    id: string;
    title: string;
    description?: string | null;
    priority: string;
    customerId: string;
}

/**
 * Creates a task in ChronusDev for a CRM ticket via Webhook
 */
export async function syncTicketToChronusDev(
    ticket: Ticket,
    customer: Customer
): Promise<string> {
    console.log(`[Sync] Syncing ticket ${ticket.id} to ChronusDev via webhook`);

    try {
        const response = await fetch(`${CHRONUSDEV_URL}/webhooks/crm/ticket-created`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Sync-Key": SYNC_KEY,
            },
            body: JSON.stringify({
                ticket: {
                    id: ticket.id,
                    title: ticket.title,
                    description: ticket.description,
                    priority: ticket.priority,
                },
                customer: {
                    id: customer.id,
                    name: customer.name,
                    email: customer.email,
                    company: customer.company
                },
                organizationId: customer.organizationId
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to create task in ChronusDev: ${errorText}`);
        }

        const result = await response.json();
        const taskId = result.taskId;

        // Update ticket with task ID if newly created
        await prisma.ticket.update({
            where: { id: ticket.id },
            data: { taskId }
        });

        console.log(`[Sync] Successfully synced ticket ${ticket.id} -> Task ${taskId}`);
        return taskId;
    } catch (error) {
        console.error(`[Sync] Error syncing ticket ${ticket.id} to ChronusDev:`, error);
        throw error;
    }
}

/**
 * Ensures customer is synced with ChronusDev
 * Creates client and project if they don't exist
 * Used for tickets of customers that haven't been synced yet
 */
export async function ensureCustomerSynced(customerId: string, organizationId: string): Promise<Customer> {
    const customer = await prisma.customer.findUnique({
        where: { id: customerId }
    });

    if (!customer) {
        throw new Error(`Customer ${customerId} not found`);
    }

    // If already synced, return as is
    if (customer.chronusDevClientId && customer.chronusDevDefaultProjectId) {
        return customer as Customer;
    }

    // Sync the customer
    await syncCustomerToChronusDev(customer as Customer, organizationId);

    // Re-fetch to get updated IDs
    const updatedCustomer = await prisma.customer.findUnique({
        where: { id: customerId }
    });

    return updatedCustomer as Customer;
}
