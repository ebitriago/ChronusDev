
import { Router } from 'express';
import { prisma } from '../db.js';
import { authMiddleware } from '../auth.js';
import { getInvoicePDFBuffer } from '../reports.js';
import { sendInvoiceEmail } from '../email.js';
import { createInvoicePaymentLink } from '../services/stripe.js';

const router = Router();

// GET /invoices
router.get("/", authMiddleware, async (req: any, res) => {
    try {
        const organizationId = req.user?.organizationId;
        if (!organizationId) return res.status(401).json({ error: "No organization context" });

        const { status, customerId, type } = req.query;
        const where: any = { organizationId };

        if (status) where.status = (status as string).toUpperCase();
        if (customerId) where.customerId = customerId as string;
        if (type) where.type = (type as string).toUpperCase();

        const invoices = await prisma.invoice.findMany({
            where: where as any,
            include: { customer: { select: { name: true, email: true } } },
            orderBy: { createdAt: 'desc' }
        });

        res.json(invoices);
    } catch (e: any) {
        console.error("GET /invoices error:", e);
        res.status(500).json({ error: e.message });
    }
});

// POST /invoices
router.post("/", authMiddleware, async (req: any, res) => {
    try {
        const organizationId = req.user?.organizationId;
        const { customerId, leadId, type, items, dueDate, notes, terms, discount, tax, paymentMethod, amount } = req.body;

        if (!organizationId) return res.status(401).json({ error: "Unauthorized" });

        // require customerId OR leadId
        if (!customerId && !leadId) {
            return res.status(400).json({ error: "Se requiere un Cliente o Lead para la factura/propuesta" });
        }

        // Generate Number
        const count = await prisma.invoice.count({ where: { organizationId } as any });
        const number = `${type === 'QUOTE' ? 'QT' : 'INV'}-${String(count + 1).padStart(6, '0')}`;

        // Calculate totals
        let subtotal = 0;
        let invoiceItems = [];

        if (items && Array.isArray(items) && items.length > 0) {
            invoiceItems = items.map((item: any) => {
                const itemTotal = (item.quantity || 1) * (item.unitPrice || 0);
                subtotal += itemTotal;
                return {
                    description: item.description || 'Servicio',
                    quantity: item.quantity || 1,
                    unitPrice: item.unitPrice || 0,
                    total: itemTotal
                };
            });
        } else if (amount) {
            // Fallback to total amount if no items provided
            subtotal = Number(amount);
            invoiceItems = [{
                description: 'Servicio',
                quantity: 1,
                unitPrice: subtotal,
                total: subtotal
            }];
        } else {
            return res.status(400).json({ error: "Se requieren items o un monto total (amount)" });
        }

        const taxAmount = (subtotal * (tax || 0)) / 100;
        const discountAmount = (subtotal * (discount || 0)) / 100;
        const total = subtotal + taxAmount - discountAmount;

        const invoice = await prisma.invoice.create({
            data: {
                organizationId,
                customerId: customerId || null,
                leadId: leadId || null,
                type: type || 'INVOICE',
                number,
                status: 'DRAFT',
                issueDate: new Date(),
                dueDate: new Date(dueDate || Date.now() + 30 * 24 * 60 * 60 * 1000),
                notes,
                terms,
                amount: total,
                subtotal,
                tax: taxAmount,
                discount: discountAmount,
                balance: total,
                paymentMethod,
                items: {
                    create: invoiceItems
                },
            } as any,
            include: { items: true, customer: true, lead: true }
        });

        res.status(201).json(invoice);
    } catch (e: any) {
        console.error("POST /invoices error:", e);
        res.status(500).json({ error: e.message });
    }
});

// PUT /invoices/:id
router.put("/:id", authMiddleware, async (req: any, res) => {
    try {
        const organizationId = req.user?.organizationId;
        const { id } = req.params;
        const { status, notes, terms, dueDate, paidAt } = req.body;

        const updateData: any = {};
        if (status) updateData.status = status;
        if (notes !== undefined) updateData.notes = notes;
        if (terms !== undefined) updateData.terms = terms;
        if (dueDate) updateData.dueDate = new Date(dueDate);
        if (status === 'PAID') updateData.paidAt = paidAt ? new Date(paidAt) : new Date();

        const invoice = await prisma.invoice.update({
            where: { id, organizationId } as any,
            data: updateData,
            include: { items: true, lead: true }
        });

        // Trigger Auto-Conversion if PAID and linked to a Lead
        if (status === 'PAID' && invoice.leadId && !invoice.customerId) {
            console.log(`[Auto-Convert] Invoice ${id} paid, converting lead ${invoice.leadId}`);
            try {
                // We reuse the logic or call the endpoint (internal call or refactor logic to helper)
                // For now, let's implement the core conversion here or import it if we had a shared service.
                // Given the current structure, I'll implement a simplified version or call the same logic.

                const lead = invoice.lead;
                if (lead) {
                    let customer = await prisma.customer.findFirst({
                        where: { email: lead.email, organizationId }
                    });

                    if (!customer) {
                        customer = await prisma.customer.create({
                            data: {
                                organizationId,
                                name: lead.name,
                                email: lead.email,
                                phone: lead.phone,
                                company: lead.company,
                                status: 'ACTIVE',
                                plan: 'FREE'
                            }
                        });
                        const { syncCustomerToChronusDev } = await import("../services/chronusdev-sync.js");
                        syncCustomerToChronusDev(customer as any, organizationId).catch(console.error);
                    }

                    // Link invoice to new customer
                    await prisma.invoice.update({
                        where: { id },
                        data: { customerId: customer.id }
                    });

                    // Update Lead
                    await prisma.lead.update({
                        where: { id: lead.id },
                        data: {
                            status: 'WON',
                            convertedAt: new Date(),
                            convertedToId: customer.id
                        }
                    });

                    const io = req.app.get('io');
                    if (io) {
                        io.to(`org_${organizationId}`).emit('lead_converted', { leadId: lead.id, clientId: customer.id });
                    }
                }
            } catch (err) {
                console.error("[Auto-Convert] Failed:", err);
            }
        }

        res.json(invoice);
    } catch (e: any) {
        console.error("PUT /invoices/:id error:", e);
        res.status(500).json({ error: e.message });
    }
});

// DELETE /invoices/:id
router.delete("/:id", authMiddleware, async (req: any, res) => {
    try {
        const organizationId = req.user?.organizationId;
        const { id } = req.params;

        await prisma.invoice.delete({
            where: { id, organizationId } as any
        });

        res.json({ success: true });
    } catch (e: any) {
        console.error("DELETE /invoices/:id error:", e);
        res.status(500).json({ error: e.message });
    }
});

// POST /invoices/:id/send
router.post("/:id/send", authMiddleware, async (req: any, res) => {
    try {
        const { id } = req.params;
        const { channel } = req.body; // 'email' | 'whatsapp'
        const organizationId = req.user?.organizationId;

        // Verify ownership and get PDF
        try {
            const { buffer, invoice, filename } = await getInvoicePDFBuffer(id);

            if (invoice.organizationId !== organizationId) {
                return res.status(403).json({ error: "No autorizado" });
            }

            // Get contact info
            const email = invoice.customer?.email || invoice.lead?.email;
            const phone = invoice.customer?.phone || invoice.lead?.phone;

            let sent = false;
            let message = "";

            if (channel === 'whatsapp') {
                if (!phone) return res.status(400).json({ error: "El cliente no tiene teléfono registrado" });

                // MOCK WhatsApp sending for now (or integrate with existing webhook/provider)
                // In a real scenario, this would upload the PDF and send the link, or send binary.
                console.log(`[Mock] Sending WhatsApp to ${phone} with PDF ${filename}`);
                sent = true;
                message = "Enviado por WhatsApp (Simulado)";
            } else {
                // Default to Email
                if (!email) return res.status(400).json({ error: "El cliente o lead no tiene email registrado" });

                sent = await sendInvoiceEmail(email, invoice, buffer);
                message = "Email enviado correctamente";
            }

            if (sent) {
                // Update status if it was draft
                if (invoice.status === 'DRAFT') {
                    await prisma.invoice.update({
                        where: { id },
                        data: { status: 'SENT' }
                    });
                }

                res.json({ success: true, message });
            } else {
                res.status(500).json({ error: "Fallo al enviar el mensaje" });
            }

        } catch (err: any) {
            console.error("Error generating PDF for sending:", err);
            return res.status(404).json({ error: err.message });
        }

    } catch (e: any) {
        console.error("POST /invoices/:id/send error:", e);
        res.status(500).json({ error: e.message });
    }
});

// POST /invoices/:id/payment-link
router.post("/:id/payment-link", authMiddleware, async (req: any, res) => {
    try {
        const { id } = req.params;
        const organizationId = req.user?.organizationId;

        const invoice = await prisma.invoice.findFirst({
            where: { id, organizationId }
        });

        if (!invoice) return res.status(404).json({ error: "Factura no encontrada" });

        // Generate Link
        const url = await createInvoicePaymentLink(invoice, "Chronus Organization"); // TODO: Fetch Org Name

        if (url) {
            res.json({ url });
        } else {
            res.status(500).json({ error: "No se pudo generar el link (Stripe no configurado)" });
        }

    } catch (e: any) {
        console.error("POST /invoices/:id/payment-link error:", e);
        res.status(500).json({ error: e.message });
    }
});

// POST /invoices/:id/convert (Quote -> Invoice)
router.post("/:id/convert", authMiddleware, async (req: any, res) => {
    try {
        const { id } = req.params;
        const organizationId = req.user?.organizationId;

        const quote = await prisma.invoice.findUnique({
            where: { id, organizationId } as any
        });
        if (!quote || (quote as any).type !== 'QUOTE') {
            return res.status(404).json({ error: "Propuesta no encontrada" });
        }

        // Generate new Invoice Number
        const invoiceNumber = `INV-${Date.now()}`;

        // Update record to type INVOICE
        const invoice = await (prisma.invoice as any).update({
            where: { id },
            data: {
                type: 'INVOICE',
                number: invoiceNumber, // New number
                status: 'DRAFT', // Reset to draft to check before sending
                createdAt: new Date(),
                dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // Reset due date to +30 days
            }
        });

        res.json(invoice);
    } catch (e: any) {
        console.error("POST /invoices/:id/convert error:", e);
        res.status(500).json({ error: e.message });
    }
});

// GET /invoices/:id/pdf
router.get("/:id/pdf", authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const { buffer, filename } = await getInvoicePDFBuffer(id);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
        res.send(buffer);
    } catch (e: any) {
        console.error("GET /invoices/:id/pdf error:", e);
        res.status(500).json({ error: e.message });
    }
});

export const invoicesRouter = router;
