import nodemailer from 'nodemailer';
import { prisma } from '../db.js';
import { Buffer } from 'buffer';

// System Environment Variables
const SYSTEM_SMTP_HOST = process.env.SMTP_HOST;
const SYSTEM_SMTP_PORT = parseInt(process.env.SMTP_PORT || '587');
const SYSTEM_SMTP_USER = process.env.SMTP_USER;
const SYSTEM_SMTP_PASS = process.env.SMTP_PASS;
const SYSTEM_SMTP_FROM = process.env.SMTP_FROM || '"ChronusCRM" <alerts@chronus.com>';

const SYSTEM_GMAIL_USER = process.env.GMAIL_USER;
const SYSTEM_GMAIL_PASS = process.env.GMAIL_APP_PASSWORD;

/**
 * Get Transporter with Priority Order:
 * 1. Organization Custom SMTP
 * 2. User/Org Integration (Gmail)
 * 3. System SMTP Env
 * 4. System Gmail Env
 */
async function getEmailTransporter(userId?: string, organizationId?: string) {
    // 1. Check Organization Custom SMTP (Highest Priority for branding)
    if (organizationId) {
        const org = await prisma.organization.findUnique({
            where: { id: organizationId },
            select: { smtpConfig: true }
        });

        if (org?.smtpConfig) {
            const config = org.smtpConfig as any;
            return {
                transporter: nodemailer.createTransport({
                    host: config.host,
                    port: parseInt(config.port),
                    secure: parseInt(config.port) === 465,
                    auth: {
                        user: config.user,
                        pass: config.pass,
                    }
                }),
                from: config.from || SYSTEM_SMTP_FROM,
                strategy: 'ORG_SMTP'
            };
        }
    }

    // 2. Check Integration (Gmail) - User Level or Org Level
    let integration = null;

    if (userId) {
        integration = await prisma.integration.findFirst({
            where: { userId, provider: 'GMAIL', isEnabled: true }
        });
    }

    if (!integration && organizationId) {
        integration = await prisma.integration.findFirst({
            where: { organizationId, provider: 'GMAIL', isEnabled: true }
        });
    }

    // Fallback to Super Admin logic if needed? Existing logic had this.
    // Keeping it simple for now, can add back if requested.

    if (integration && integration.credentials) {
        const creds = integration.credentials as any;
        if (creds.user && creds.appPassword) {
            return {
                transporter: nodemailer.createTransport({
                    service: 'gmail',
                    auth: {
                        user: creds.user,
                        pass: creds.appPassword,
                    },
                }),
                from: creds.user, // Gmail usually forces this anyway
                strategy: 'INTEGRATION_GMAIL'
            };
        }
    }

    // 3. System SMTP Environment
    if (SYSTEM_SMTP_HOST && SYSTEM_SMTP_USER) {
        return {
            transporter: nodemailer.createTransport({
                host: SYSTEM_SMTP_HOST,
                port: SYSTEM_SMTP_PORT,
                secure: SYSTEM_SMTP_PORT === 465,
                auth: {
                    user: SYSTEM_SMTP_USER,
                    pass: SYSTEM_SMTP_PASS,
                }
            }),
            from: SYSTEM_SMTP_FROM,
            strategy: 'SYSTEM_SMTP'
        };
    }

    // 4. System Gmail Environment (Legacy fallback)
    if (SYSTEM_GMAIL_USER && SYSTEM_GMAIL_PASS) {
        return {
            transporter: nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    user: SYSTEM_GMAIL_USER,
                    pass: SYSTEM_GMAIL_PASS,
                },
            }),
            from: SYSTEM_GMAIL_USER,
            strategy: 'SYSTEM_GMAIL'
        };
    }

    return null;
}

interface EmailOptions {
    to: string;
    subject: string;
    text?: string;
    html?: string;
    replyTo?: string;
    userId?: string;
    organizationId?: string;
    attachments?: any[];
}

/**
 * Unified Send Email Function
 */
export async function sendEmail(options: EmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
        const result = await getEmailTransporter(options.userId, options.organizationId);

        if (!result) {
            console.warn('[Email] No email configuration found. Email NOT sent.');
            return { success: false, error: 'Email configuration missing' };
        }

        const { transporter, from } = result;

        const info = await transporter.sendMail({
            from: from, // Use resolved from address
            to: options.to,
            subject: options.subject,
            text: options.text,
            html: options.html,
            replyTo: options.replyTo,
            attachments: options.attachments
        });

        console.log(`[Email] Sent to ${options.to} via ${result.strategy}: ${info.messageId}`);
        return { success: true, messageId: info.messageId };

    } catch (err: any) {
        console.error('[Email] Send error:', err.message);
        return { success: false, error: err.message };
    }
}

/**
 * Verify Connection (Checks System Env only for startup health)
 */
export async function verifyEmailConnection(): Promise<boolean> {
    if (SYSTEM_SMTP_HOST || (SYSTEM_GMAIL_USER && SYSTEM_GMAIL_PASS)) {
        console.log('[Email] ✅ System email configuration detected');
        return true;
    }
    console.log('[Email] ⚠️ No system email configuration. Relying on dynamic Organization/Integration configs.');
    return true;
}

/**
 * Specific wrapper for Invoice Emails (Backward compatibility for route usage)
 */
export async function sendInvoiceEmail(to: string, invoice: any, pdfBuffer: Buffer) {
    const isQuote = invoice.type === 'QUOTE';
    const title = isQuote ? 'Propuesta Económica' : 'Nueva Factura';
    const number = invoice.number;

    const subject = `${title} #${number} - ${invoice.customer?.company || invoice.customer?.name}`;

    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #059669;">${title} Disponible</h2>
            <p>Hola <strong>${invoice.customer?.name}</strong>,</p>
            <p>Adjunto encontrarás el documento <strong>#${number}</strong> por un monto de <strong>${invoice.currency} $${invoice.amount.toLocaleString()}</strong>.</p>
            
            ${isQuote ?
            `<p>Esta propuesta es válida hasta el ${new Date(invoice.validUntil || Date.now()).toLocaleDateString()}.</p>` :
            `<p>La fecha de vencimiento es ${new Date(invoice.dueDate).toLocaleDateString()}.</p>`
        }
            
            <p>Si tienes alguna pregunta, no dudes en responder a este correo.</p>
            
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="color: #666; font-size: 12px;">Enviado desde ChronusCRM</p>
        </div>
    `;

    const result = await sendEmail({
        organizationId: invoice.organizationId,
        to,
        subject,
        html,
        attachments: [
            {
                filename: `${isQuote ? 'Propuesta' : 'Factura'}-${number}.pdf`,
                content: pdfBuffer
            }
        ]
    });

    return result.success;
}

// Predefined email templates (Moved from old src/email.ts)
export const emailTemplates = {
    welcome: (clientName: string, loginUrl: string) => ({
        subject: `🎉 Bienvenido a nuestro servicio, ${clientName}!`,
        html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #10B981, #0D9488); padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0;">¡Bienvenido, ${clientName}!</h1>
        </div>
        <div style="padding: 30px; background: #f9fafb;">
          <p>Gracias por unirte. Estamos emocionados de tenerte como cliente.</p>
          <p>Para comenzar, puedes acceder a tu cuenta aquí:</p>
          <a href="${loginUrl}" style="display: inline-block; background: #10B981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin: 20px 0;">Acceder a mi cuenta</a>
        </div>
      </div>
    `,
    }),
    ticketUpdate: (ticketTitle: string, status: string, message: string) => ({
        subject: `[Ticket] ${ticketTitle} - ${status}`,
        html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #3B82F6; padding: 20px; color: white;">
          <h2 style="margin: 0;">Actualización de Ticket</h2>
        </div>
        <div style="padding: 25px; background: white; border: 1px solid #E5E7EB;">
          <p><strong>Ticket:</strong> ${ticketTitle}</p>
          <p><strong>Estado:</strong> ${status}</p>
          <p>${message}</p>
        </div>
      </div>
    `,
    }),
    newLead: (leadName: string, leadEmail: string, source: string, notes?: string) => ({
        subject: `🎯 Nuevo Lead: ${leadName}`,
        html: `
      <div>
          <h2>Nuevo Lead Registrado</h2>
          <p>Nombre: ${leadName}</p>
          <p>Email: ${leadEmail}</p>
          <p>Fuente: ${source}</p>
          ${notes ? `<p>Notas: ${notes}</p>` : ''}
      </div>
    `,
    }),
    passwordReset: (resetLink: string) => ({
        subject: `🔒 Recuperación de Contraseña - ChronusCRM`,
        html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #3B82F6; padding: 20px; text-align: center;">
                <h2 style="color: white; margin: 0;">Recuperación de Contraseña</h2>
            </div>
            <div style="padding: 30px; background: #f9fafb; border: 1px solid #E5E7EB;">
                <p>Hola,</p>
                <p>Hemos recibido una solicitud para restablecer tu contraseña.</p>
                <p>Si no fuiste tú, puedes ignorar este correo.</p>
                <p>Para continuar, haz clic en el siguiente enlace:</p>
                <a href="${resetLink}" style="display: inline-block; background: #3B82F6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin: 20px 0;">Restablecer Contraseña</a>
                <p style="font-size: 12px; color: #666;">Este enlace expirará en 1 hora.</p>
            </div>
        </div>
        `
    })
};

export default { sendEmail, verifyEmailConnection, emailTemplates, sendInvoiceEmail };
