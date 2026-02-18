// Unified Email Service for ChronusDev
// Supports Gmail Integrations + Generic SMTP Fallback

import nodemailer from 'nodemailer';
import { prisma } from './db.js';

// System Environment Variables
const SYSTEM_SMTP_HOST = process.env.SMTP_HOST;
const SYSTEM_SMTP_PORT = parseInt(process.env.SMTP_PORT || '587');
const SYSTEM_SMTP_USER = process.env.SMTP_USER;
const SYSTEM_SMTP_PASS = process.env.SMTP_PASS;
const SYSTEM_SMTP_FROM = process.env.SMTP_FROM || '"ChronusDev" <alerts@chronus.com>';

const SYSTEM_GMAIL_USER = process.env.GMAIL_USER;
const SYSTEM_GMAIL_PASS = process.env.GMAIL_APP_PASSWORD;

async function getEmailTransporter(userId?: string, organizationId?: string) {
  let integration = null;

  // 1. Check Integration (Gmail) - User Level or Org Level
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

  if (!integration) {
    integration = await prisma.integration.findFirst({
      where: {
        provider: 'GMAIL',
        isEnabled: true,
        OR: [
          { userId: null },
          { user: { role: 'SUPER_ADMIN' } }
        ]
      },
      include: { user: true }
    });
  }

  // If Integration Found (Existing Gmail Logic)
  if (integration && integration.credentials && typeof integration.credentials === 'object') {
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
        from: creds.user,
        strategy: 'INTEGRATION_GMAIL'
      };
    }
  }

  // 2. System SMTP Environment (New generic support)
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

  // 3. System Gmail Environment (Legacy fallback)
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
}

export async function sendEmail(options: EmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const result = await getEmailTransporter(options.userId, options.organizationId);

  if (!result) {
    return { success: false, error: 'Email no configurado' };
  }

  const { transporter, from } = result;

  try {
    const info = await transporter.sendMail({
      from: from || process.env.GMAIL_USER || 'noreply@chronusdev.com',
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
      replyTo: options.replyTo,
    });

    console.log(`[Email] Sent to ${options.to} via ${result.strategy}: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error: any) {
    console.error('[Email] Send error:', error);
    return { success: false, error: error.message };
  }
}

export async function verifyEmailConnection(): Promise<boolean> {
  if (SYSTEM_SMTP_HOST || (SYSTEM_GMAIL_USER && SYSTEM_GMAIL_PASS)) {
    console.log('[Email] ✅ System email configuration detected');
    return true;
  }
  return true;
}

export const emailTemplates = {
  projectInvitation: (projectName: string, inviterName: string, link: string) => ({
    subject: `Invitación al proyecto: ${projectName}`,
    html: `
      <h2>Invitación al Proyecto</h2>
      <p>Hola,</p>
      <p>${inviterName} te ha invitado a unirte al proyecto <strong>${projectName}</strong> en ChronusDev.</p>
      <p><a href="${link}">Aceptar invitación</a></p>
    `
  }),
  taskAssigned: (taskTitle: string, projectName: string, link: string) => ({
    subject: `Nueva tarea asignada: ${taskTitle}`,
    html: `
      <h2>Nueva Tarea Asignada</h2>
      <p>Se te ha asignado una nueva tarea:</p>
      <p><strong>${taskTitle}</strong></p>
      <p>Proyecto: ${projectName}</p>
      <p><a href="${link}">Ver tarea</a></p>
    `
  }),
  payoutCreated: (amount: number, month: string) => ({
    subject: `Pago registrado - ${month}`,
    html: `
      <h2>Pago Registrado</h2>
      <p>Se ha registrado un pago de $${amount} para el período ${month}.</p>
    `
  }),
  passwordReset: (resetLink: string) => ({
    subject: `🔒 Recuperación de Contraseña - ChronusDev`,
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

export default { sendEmail, verifyEmailConnection, emailTemplates };
