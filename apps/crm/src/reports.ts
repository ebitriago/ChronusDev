// Reporting Service using PDFKit
import PDFDocument from 'pdfkit';
import { prisma } from './db.js';
import { Response } from 'express';

// Generate Invoice PDF
// Helper to build the PDF content
function buildInvoicePDF(doc: PDFKit.PDFDocument, invoice: any, organization?: any) {
    // Header
    const title = invoice.type === 'QUOTE' ? 'PROPUESTA ECONOMICA' : 'FACTURA';
    const dateLabel = invoice.type === 'QUOTE' ? 'Fecha Emisión' : 'Fecha';
    const dueLabel = invoice.type === 'QUOTE' ? 'Válido Hasta' : 'Vencimiento';

    // Organization info - use provided data or defaults
    const orgName = organization?.name || 'ChronusCRM';
    const orgAddress = organization?.address || '';
    const orgCity = organization?.city || '';
    const orgEmail = organization?.email || 'soporte@chronuscrm.com';
    const orgPhone = organization?.phone || '';

    doc
        .fontSize(20)
        .text(title, 50, 50)
        .fontSize(10)
        .text(orgName, { align: 'right' });

    if (orgAddress) doc.text(orgAddress, { align: 'right' });
    if (orgCity) doc.text(orgCity, { align: 'right' });
    if (orgPhone) doc.text(orgPhone, { align: 'right' });
    doc.text(orgEmail, { align: 'right' }).moveDown();

    // Invoice Details
    doc
        .fontSize(10)
        .text(`${invoice.type === 'QUOTE' ? 'Cotización' : 'Número'}: ${invoice.number}`, 50, 130)
        .text(`${dateLabel}: ${invoice.createdAt.toLocaleDateString()}`, 50, 145)
        .text(`${dueLabel}: ${(invoice.validUntil || invoice.dueDate).toLocaleDateString()}`, 50, 160)
        .text(`Estado: ${invoice.status}`, 50, 175);

    // Terms
    if (invoice.terms) {
        doc.text(`Términos: ${invoice.terms}`, 50, 190);
    }

    // Customer Details
    doc
        .text('CLIENTE:', 300, 130)
        .font('Helvetica-Bold')
        .text(invoice.customer.name, 300, 145)
        .font('Helvetica')
        .text(invoice.customer.email, 300, 160)
        .text(invoice.customer.phone || '', 300, 175)
        .text(invoice.customer.company || '', 300, 190);

    // Items Table Header
    const tableTop = 230;
    doc
        .moveTo(50, tableTop)
        .lineTo(550, tableTop)
        .stroke()
        .font('Helvetica-Bold')
        .text('Descripción', 50, tableTop + 5)
        .text('Cant.', 350, tableTop + 5, { width: 50, align: 'center' })
        .text('Precio', 400, tableTop + 5, { width: 70, align: 'right' })
        .text('Total', 480, tableTop + 5, { width: 70, align: 'right' });

    doc
        .moveTo(50, tableTop + 20)
        .lineTo(550, tableTop + 20)
        .stroke()
        .font('Helvetica');

    // Items List
    let y = tableTop + 30;
    invoice.items.forEach((item: any) => {
        doc
            .text(item.description, 50, y)
            .text(item.quantity.toString(), 350, y, { width: 50, align: 'center' })
            .text(`$${item.unitPrice.toFixed(2)}`, 400, y, { width: 70, align: 'right' })
            .text(`$${item.total.toFixed(2)}`, 480, y, { width: 70, align: 'right' });
        y += 20;
    });

    // Total
    doc
        .moveTo(50, y + 10)
        .lineTo(550, y + 10)
        .stroke()
        .font('Helvetica-Bold')
        .fontSize(12)
        .text('TOTAL:', 400, y + 20, { width: 70, align: 'right' })
        .text(`$${invoice.amount.toFixed(2)}`, 480, y + 20, { width: 70, align: 'right' });

    // Footer
    doc
        .fontSize(10)
        .font('Helvetica')
        .text('Gracias por su negocio.', 50, 700, { align: 'center', width: 500 });
}

// Generate Invoice PDF - Stream to Response
export async function generateInvoicePDF(invoiceId: string, res: Response, organizationId?: string) {
    const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
        include: {
            customer: true,
            items: true,
            payments: true,
        },
    });

    if (!invoice) {
        throw new Error('Factura no encontrada'); // Invoice not found
    }

    // Fetch organization data for branding
    const orgId = organizationId || invoice.customer?.organizationId;
    const organization = orgId ? await prisma.organization.findUnique({
        where: { id: orgId }
    }) : null;

    const doc = new PDFDocument({ margin: 50 });

    // Stream directly to response
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=${invoice.type === 'QUOTE' ? 'propuesta' : 'factura'}-${invoice.number}.pdf`);
    doc.pipe(res);

    buildInvoicePDF(doc, invoice, organization);

    doc.end();
}

// Get Invoice PDF as Buffer (for Email)
export async function getInvoicePDFBuffer(invoiceId: string, organizationId?: string): Promise<{ buffer: Buffer, invoice: any, filename: string }> {
    const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
        include: {
            customer: true,
            items: true,
            payments: true,
        },
    });

    if (!invoice) {
        throw new Error('Factura no encontrada');
    }

    // Fetch organization data for branding
    const orgId = organizationId || invoice.customer?.organizationId;
    const organization = orgId ? await prisma.organization.findUnique({
        where: { id: orgId }
    }) : null;

    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ margin: 50 });
        const buffers: Buffer[] = [];

        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => {
            const buffer = Buffer.concat(buffers);
            resolve({
                buffer,
                invoice,
                filename: `${invoice.type === 'QUOTE' ? 'Propuesta' : 'Factura'}-${invoice.number}.pdf`
            });
        });
        doc.on('error', reject);

        buildInvoicePDF(doc, invoice, organization);

        doc.end();
    });
}

// Generate General Report (Analytics)
export async function generateAnalyticsPDF(res: Response) {
    const doc = new PDFDocument({ margin: 50 });

    // Stream
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=chronus-report-${Date.now()}.pdf`);
    doc.pipe(res);

    // Header
    doc
        .fontSize(20)
        .text('Reporte General ChronusCRM', { align: 'center' })
        .moveDown();

    doc
        .fontSize(12)
        .text(`Generado el: ${new Date().toLocaleString()}`, { align: 'center' })
        .moveDown(2);

    // Basic Stats fetch
    const customersCount = await prisma.customer.count();
    const ticketsCount = await prisma.ticket.count();
    const openTicketsCount = await prisma.ticket.count({ where: { status: 'OPEN' } });
    const leadsCount = await prisma.lead.count();

    // Stats Grid
    doc
        .fontSize(14)
        .text('Métricas Clave')
        .moveDown()
        .fontSize(12);

    doc.text(`• Total Clientes: ${customersCount}`);
    doc.text(`• Total Leads: ${leadsCount}`);
    doc.text(`• Total Tickets: ${ticketsCount}`);
    doc.text(`• Tickets Abiertos: ${openTicketsCount}`);

    doc.moveDown(2);

    doc.fontSize(10).text('Este es un reporte generado automáticamente.', { align: 'center' });

    doc.end();
}

