/**
 * CSV Export Utilities for Team & Payments
 */

export interface TeamMemberData {
    name: string;
    email: string;
    role: string;
    defaultPayRate: number;
    totalHours: number;
    totalDebt: number;
    totalPaid: number;
    balance: number;
}

/**
 * Generate CSV content from team member data
 */
export function generateTeamCSV(
    members: TeamMemberData[],
    includeHeaders: boolean = true
): string {
    const headers = [
        'Nombre',
        'Email',
        'Rol',
        'Tarifa/hr',
        'Horas',
        'Debe',
        'Pagado',
        'Saldo'
    ];

    const rows = members.map(member => [
        escapeCSVField(member.name),
        escapeCSVField(member.email),
        member.role,
        `$${member.defaultPayRate}`,
        member.totalHours.toFixed(1),
        `$${member.totalDebt.toLocaleString()}`,
        `$${member.totalPaid.toLocaleString()}`,
        `$${member.balance.toLocaleString()}`
    ]);

    const csvLines = includeHeaders ? [headers, ...rows] : rows;
    return csvLines.map(row => row.join(',')).join('\n');
}

/**
 * Escape special characters in CSV fields
 */
function escapeCSVField(field: string): string {
    if (!field) return '';

    // If field contains comma, quote, or newline, wrap in quotes and escape quotes
    if (field.includes(',') || field.includes('"') || field.includes('\n')) {
        return `"${field.replace(/"/g, '""')}"`;
    }

    return field;
}

/**
 * Trigger browser download of CSV file
 */
export function downloadCSV(content: string, filename: string): void {
    // Add UTF-8 BOM for Excel compatibility
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + content], { type: 'text/csv;charset=utf-8;' });

    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Clean up
    URL.revokeObjectURL(url);
}

/**
 * Export team data to CSV
 */
export function exportTeamToCSV(members: TeamMemberData[]): void {
    const csvContent = generateTeamCSV(members);
    const filename = `equipo_${new Date().toISOString().split('T')[0]}.csv`;
    downloadCSV(csvContent, filename);
}

/**
 * Export team data to ODS (OpenDocument Spreadsheet)
 */
export async function exportTeamToODS(members: TeamMemberData[]): Promise<void> {
    // Dynamically import xlsx to avoid bundle bloat
    const XLSX = await import('xlsx');

    const headers = [
        'Nombre',
        'Email',
        'Rol',
        'Tarifa/hr',
        'Horas',
        'Debe',
        'Pagado',
        'Saldo'
    ];

    const data = members.map(member => [
        member.name,
        member.email,
        member.role,
        member.defaultPayRate,
        member.totalHours,
        member.totalDebt,
        member.totalPaid,
        member.balance
    ]);

    // Create worksheet
    const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);

    // Set column widths
    ws['!cols'] = [
        { wch: 20 }, // Nombre
        { wch: 25 }, // Email
        { wch: 10 }, // Rol
        { wch: 12 }, // Tarifa/hr
        { wch: 10 }, // Horas
        { wch: 12 }, // Debe
        { wch: 12 }, // Pagado
        { wch: 12 }  // Saldo
    ];

    // Create workbook
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Equipo');

    // Generate ODS file
    const filename = `equipo_${new Date().toISOString().split('T')[0]}.ods`;
    XLSX.writeFile(wb, filename, { bookType: 'ods' });
}

/**
 * Export team data to PDF
 */
export async function exportTeamToPDF(members: TeamMemberData[]): Promise<void> {
    // Dynamically import jsPDF to avoid bundle bloat
    const { default: jsPDF } = await import('jspdf');
    await import('jspdf-autotable');

    const doc = new jsPDF() as any;

    // Add title
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Reporte de Equipo', 14, 22);

    // Add date
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const dateStr = new Date().toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    doc.text(`Generado: ${dateStr}`, 14, 30);

    // Add summary
    const totalHours = members.reduce((sum, m) => sum + m.totalHours, 0);
    const totalDebt = members.reduce((sum, m) => sum + m.totalDebt, 0);
    const totalPaid = members.reduce((sum, m) => sum + m.totalPaid, 0);
    const totalBalance = members.reduce((sum, m) => sum + m.balance, 0);

    doc.setFontSize(9);
    doc.text(`Total Miembros: ${members.length}`, 14, 38);
    doc.text(`Total Horas: ${totalHours.toFixed(1)}`, 70, 38);
    doc.text(`Total Debe: $${totalDebt.toLocaleString()}`, 120, 38);
    doc.text(`Saldo: $${totalBalance.toLocaleString()}`, 170, 38);

    // Prepare table data
    const tableData = members.map(member => [
        member.name,
        member.email,
        member.role,
        `$${member.defaultPayRate}`,
        member.totalHours.toFixed(1),
        `$${member.totalDebt.toLocaleString()}`,
        `$${member.totalPaid.toLocaleString()}`,
        `$${member.balance.toLocaleString()}`
    ]);

    // Add table
    doc.autoTable({
        startY: 45,
        head: [['Nombre', 'Email', 'Rol', 'Tarifa/hr', 'Horas', 'Debe', 'Pagado', 'Saldo']],
        body: tableData,
        theme: 'striped',
        headStyles: {
            fillColor: [139, 92, 246], // Purple
            textColor: 255,
            fontStyle: 'bold',
            fontSize: 9
        },
        bodyStyles: {
            fontSize: 8
        },
        columnStyles: {
            0: { cellWidth: 30 }, // Nombre
            1: { cellWidth: 45 }, // Email
            2: { cellWidth: 20 }, // Rol
            3: { cellWidth: 22 }, // Tarifa
            4: { cellWidth: 18 }, // Horas
            5: { cellWidth: 22 }, // Debe
            6: { cellWidth: 22 }, // Pagado
            7: { cellWidth: 22 }  // Saldo
        },
        margin: { left: 14, right: 14 }
    });

    // Add footer
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(128);
        doc.text(
            `Página ${i} de ${pageCount}`,
            doc.internal.pageSize.width / 2,
            doc.internal.pageSize.height - 10,
            { align: 'center' }
        );
    }

    // Save PDF
    const filename = `equipo_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(filename);
}
