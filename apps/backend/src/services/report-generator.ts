import PDFDocument from 'pdfkit';
import { Response } from 'express';

export interface ReportData {
    title: string;
    organizationName: string;
    filters: {
        startDate?: string;
        endDate?: string;
        userName?: string;
        projectName?: string;
        clientName?: string;
    };
    timeLogs: any[];
    summary: {
        totalHours: number;
        totalPay: number;
        totalBill: number;
        currency: string;
    };
}

export class ReportGenerator {
    static async generatePDF(data: ReportData, res: Response) {
        const doc = new PDFDocument({ margin: 50, size: 'A4' });

        // Stream to response
        doc.pipe(res);

        // Header
        this.drawHeader(doc, data);

        // Filters Summary
        this.drawFilters(doc, data);

        // Summary Cards
        this.drawSummaryCards(doc, data);

        // TimeLogs Table
        this.drawTimeLogsTable(doc, data);

        // Footer
        this.drawFooter(doc);

        doc.end();
    }

    private static drawHeader(doc: PDFKit.PDFDocument, data: ReportData) {
        doc
            .fillColor('#1e293b')
            .fontSize(24)
            .font('Helvetica-Bold')
            .text(data.title, 50, 50);

        doc
            .fontSize(10)
            .font('Helvetica')
            .fillColor('#64748b')
            .text(data.organizationName, 50, 80)
            .text(`Generado el: ${new Date().toLocaleString()}`, 50, 95);

        // Horizontal line
        doc
            .moveTo(50, 115)
            .lineTo(550, 115)
            .strokeColor('#e2e8f0')
            .stroke();
    }

    private static drawFilters(doc: PDFKit.PDFDocument, data: ReportData) {
        doc
            .fillColor('#475569')
            .fontSize(10)
            .font('Helvetica-Bold')
            .text('Filtros Aplicados:', 50, 130);

        let filterText = '';
        if (data.filters.startDate || data.filters.endDate) {
            filterText += `Rango: ${data.filters.startDate || '...'} a ${data.filters.endDate || '...'} | `;
        }
        if (data.filters.userName) filterText += `Usuario: ${data.filters.userName} | `;
        if (data.filters.projectName) filterText += `Proyecto: ${data.filters.projectName} | `;
        if (data.filters.clientName) filterText += `Cliente: ${data.filters.clientName} | `;

        doc
            .font('Helvetica')
            .fontSize(9)
            .text(filterText || 'Ninguno (Todo el historial)', 50, 145);
    }

    private static drawSummaryCards(doc: PDFKit.PDFDocument, data: ReportData) {
        const startY = 175;
        const cardWidth = 150;
        const gap = 15;

        // Card 1: Hours
        this.drawCard(doc, 50, startY, cardWidth, 'Horas Totales', `${data.summary.totalHours.toFixed(2)}h`, '#8b5cf6');

        // Card 2: Costo Interno
        this.drawCard(doc, 50 + cardWidth + gap, startY, cardWidth, 'Costo Interno', `${data.summary.currency} ${data.summary.totalPay.toLocaleString()}`, '#6366f1');

        // Card 3: Facturable
        this.drawCard(doc, 50 + (cardWidth + gap) * 2, startY, cardWidth, 'Total Facturable', `${data.summary.currency} ${data.summary.totalBill.toLocaleString()}`, '#10b981');
    }

    private static drawCard(doc: PDFKit.PDFDocument, x: number, y: number, width: number, label: string, value: string, color: string) {
        doc
            .roundedRect(x, y, width, 60, 8)
            .fillColor('#f8fafc')
            .fill()
            .lineWidth(1)
            .strokeColor('#e2e8f0')
            .stroke();

        doc
            .fillColor(color)
            .fontSize(8)
            .font('Helvetica-Bold')
            .text(label.toUpperCase(), x + 15, y + 15);

        doc
            .fillColor('#1e293b')
            .fontSize(16)
            .font('Helvetica-Bold')
            .text(value, x + 15, y + 30);
    }

    private static drawTimeLogsTable(doc: PDFKit.PDFDocument, data: ReportData) {
        const tableTop = 260;
        doc
            .fillColor('#1e293b')
            .fontSize(12)
            .font('Helvetica-Bold')
            .text('Detalle de Registros', 50, tableTop);

        const headerY = tableTop + 25;
        doc
            .fillColor('#94a3b8')
            .fontSize(8)
            .font('Helvetica-Bold');

        doc.text('FECHA', 50, headerY);
        doc.text('USUARIO', 120, headerY);
        doc.text('PROYECTO', 220, headerY);
        doc.text('TAREA / DESCRIPCIÓN', 320, headerY);
        doc.text('HORAS', 480, headerY, { width: 40, align: 'right' });
        doc.text('TOTAL', 520, headerY, { width: 30, align: 'right' });

        doc
            .moveTo(50, headerY + 12)
            .lineTo(550, headerY + 12)
            .strokeColor('#f1f5f9')
            .stroke();

        let rowY = headerY + 25;
        doc.font('Helvetica').fontSize(8).fillColor('#334155');

        data.timeLogs.forEach((log) => {
            if (rowY > 750) {
                doc.addPage();
                rowY = 50;
            }

            const date = new Date(log.start).toLocaleDateString();
            const hours = log.end ? (new Date(log.end).getTime() - new Date(log.start).getTime()) / 3600000 : 0;
            const total = (hours * (log.billRate || 0)).toLocaleString();

            doc.text(date, 50, rowY);
            doc.text(log.user.name.substring(0, 18), 120, rowY);
            doc.text(log.project.name.substring(0, 18), 220, rowY);
            doc.text((log.task?.title || log.description || '-').substring(0, 35), 320, rowY);
            doc.text(hours.toFixed(2), 480, rowY, { width: 40, align: 'right' });
            doc.text(total, 520, rowY, { width: 30, align: 'right' });

            rowY += 20;

            doc
                .moveTo(50, rowY - 5)
                .lineTo(550, rowY - 5)
                .strokeColor('#f8fafc')
                .stroke();
        });
    }

    private static drawFooter(doc: PDFKit.PDFDocument) {
        const pages = (doc as any)._pageBuffer.length;

        for (let i = 0; i < pages; i++) {
            doc.switchToPage(i);
            doc
                .fillColor('#94a3b8')
                .fontSize(8)
                .text(
                    `ChronusDev Reports Service - Página ${i + 1} de ${pages}`,
                    50,
                    780,
                    { align: 'center', width: 500 }
                );
        }
    }

    static generateCSV(data: ReportData): string {
        const header = ['Fecha', 'Usuario', 'Proyecto', 'Cliente', 'Tarea/Descripción', 'Horas', 'Costo Interno', 'Facturable'].join(',');

        const rows = data.timeLogs.map(log => {
            const hours = log.end ? (new Date(log.end).getTime() - new Date(log.start).getTime()) / 3600000 : 0;
            const payCost = hours * (log.payRate || 0);
            const billCost = hours * (log.billRate || 0);

            return [
                new Date(log.start).toISOString().split('T')[0],
                `"${log.user.name}"`,
                `"${log.project.name}"`,
                `"${log.project.client?.name || 'N/A'}"`,
                `"${log.task?.title || log.description || '-'}"`,
                hours.toFixed(2),
                payCost.toFixed(2),
                billCost.toFixed(2)
            ].join(',');
        });

        return [header, ...rows].join('\n');
    }
}
