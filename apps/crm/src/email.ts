// Email service using Gmail SMTP with nodemailer
import nodemailer from 'nodemailer';
import { prisma } from './db.js';

// Helper to get transporter with dynamic credentials
async function getEmailTransporter() {
  // 1. Try to find an enabled System or Super Admin Gmail integration
  const integration = await prisma.integration.findFirst({
    where: {
      provider: 'GMAIL',
      isEnabled: true,
      OR: [
        { userId: null }, // System integration (if we supported it)
        { user: { role: 'SUPER_ADMIN' } } // Configured by Super Admin
      ]
    },
    include: { user: true }
  });

  let user = process.env.GMAIL_USER;
  let pass = process.env.GMAIL_APP_PASSWORD;

  // 2. Override with DB credentials if found
  if (integration && integration.credentials && typeof integration.credentials === 'object') {
    const creds = integration.credentials as any;
    if (creds.user && creds.appPassword) {
      user = creds.user;
      pass = creds.appPassword;
      // console.log(`[Email] Using database credentials for ${user}`);
    }
  }

  if (!user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  });
}

// Verify SMTP connection on startup (checks .env primarily, or awaits DB?)
// Note: This runs on module load usually, which might be too early for DB. 
// We'll verify .env here for immediate feedback, but sendEmail will be more robust.
export async function verifyEmailConnection(): Promise<boolean> {
  // We check if basic .env is set for dev convenience
  if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });
    try {
      await transporter.verify();
      console.log('[Email] ✅ Gmail SMTP connection verified (Environment)');
      return true;
    } catch (err) {
      console.error('[Email] ❌ Gmail SMTP connection failed (Environment):', err);
      // Don't return false yet, maybe DB creds work
    }
  }
  return true; // Assume dynamic might work later
}

// Email templates
interface EmailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  replyTo?: string;
}

// Send a single email
export async function sendEmail(options: EmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const transporter = await getEmailTransporter();

  if (!transporter) {
    console.error('[Email] No Gmail configuration found (Env or DB)');
    return { success: false, error: 'Gmail no configurado' };
  }

  try {
    // Retrieve the user from the transporter auth to use in "From"
    // nodemailer transporter object structure has 'transporter.auth.user'
    const fromEmail = (transporter.transporter as any).auth?.user || 'noreply@chronuscrm.com';

    const info = await transporter.sendMail({
      from: `"ChronusCRM" <${fromEmail}>`,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
      replyTo: options.replyTo,
    });

    console.log(`[Email] Sent to ${options.to}: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (err: any) {
    console.error('[Email] Send error:', err.message);
    return { success: false, error: err.message };
  }
}

// Predefined email templates
export const emailTemplates = {
  // Welcome email for new clients
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
          <p style="color: #6B7280; font-size: 14px;">Si tienes alguna pregunta, no dudes en contactarnos.</p>
        </div>
        <div style="background: #1F2937; color: #9CA3AF; padding: 20px; text-align: center; font-size: 12px;">
          <p>Este email fue enviado por ChronusCRM</p>
        </div>
      </div>
    `,
  }),

  // Ticket update notification
  ticketUpdate: (ticketTitle: string, status: string, message: string) => ({
    subject: `[Ticket] ${ticketTitle} - ${status}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #3B82F6; padding: 20px; color: white;">
          <h2 style="margin: 0;">Actualización de Ticket</h2>
        </div>
        <div style="padding: 25px; background: white; border: 1px solid #E5E7EB;">
          <p><strong>Ticket:</strong> ${ticketTitle}</p>
          <p><strong>Estado:</strong> <span style="background: #DBEAFE; color: #1E40AF; padding: 4px 8px; border-radius: 4px;">${status}</span></p>
          <p style="border-left: 3px solid #3B82F6; padding-left: 15px; margin: 20px 0;">${message}</p>
        </div>
      </div>
    `,
  }),

  // Invoice notification
  invoice: (clientName: string, invoiceNumber: string, amount: string, dueDate: string, paymentUrl: string) => ({
    subject: `📄 Factura ${invoiceNumber} - Pago pendiente`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #1F2937; padding: 20px; color: white;">
          <h2 style="margin: 0;">Nueva Factura</h2>
        </div>
        <div style="padding: 25px; background: white; border: 1px solid #E5E7EB;">
          <p>Hola ${clientName},</p>
          <p>Tienes una nueva factura pendiente de pago:</p>
          <table style="width: 100%; margin: 20px 0; border-collapse: collapse;">
            <tr><td style="padding: 8px 0; color: #6B7280;">Factura #</td><td style="padding: 8px 0; font-weight: bold;">${invoiceNumber}</td></tr>
            <tr><td style="padding: 8px 0; color: #6B7280;">Monto</td><td style="padding: 8px 0; font-weight: bold; font-size: 20px; color: #10B981;">${amount}</td></tr>
            <tr><td style="padding: 8px 0; color: #6B7280;">Vencimiento</td><td style="padding: 8px 0;">${dueDate}</td></tr>
          </table>
          <a href="${paymentUrl}" style="display: inline-block; background: #10B981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px;">Pagar ahora</a>
        </div>
      </div>
    `,
  }),

  // Lead notification to sales team
  newLead: (leadName: string, leadEmail: string, source: string, notes?: string) => ({
    subject: `🎯 Nuevo Lead: ${leadName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #8B5CF6, #7C3AED); padding: 20px; color: white;">
          <h2 style="margin: 0;">🎯 Nuevo Lead Registrado</h2>
        </div>
        <div style="padding: 25px; background: white; border: 1px solid #E5E7EB;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 8px 0; color: #6B7280;">Nombre</td><td style="padding: 8px 0; font-weight: bold;">${leadName}</td></tr>
            <tr><td style="padding: 8px 0; color: #6B7280;">Email</td><td style="padding: 8px 0;"><a href="mailto:${leadEmail}">${leadEmail}</a></td></tr>
            <tr><td style="padding: 8px 0; color: #6B7280;">Fuente</td><td style="padding: 8px 0;"><span style="background: #EDE9FE; color: #7C3AED; padding: 2px 8px; border-radius: 4px;">${source}</span></td></tr>
            ${notes ? `<tr><td style="padding: 8px 0; color: #6B7280;">Notas</td><td style="padding: 8px 0;">${notes}</td></tr>` : ''}
          </table>
        </div>
      </div>
    `,
  }),
};

export default { sendEmail, verifyEmailConnection, emailTemplates };
