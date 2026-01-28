import { prisma } from './src/db.ts';

async function main() {
    console.log('🌱 Seeding Chats & Messages...');

    // 1. WhatsApp Chat
    const waSessionId = '584121234567';
    await prisma.conversation.upsert({
        where: { sessionId: waSessionId },
        update: { updatedAt: new Date() },
        create: {
            sessionId: waSessionId,
            platform: 'WHATSAPP',
            status: 'ACTIVE',
            customerName: 'Bernardo User',
            customerContact: '+58 412 123 4567',
            messages: {
                create: [
                    { content: 'Hola, quería información sobre los planes', sender: 'USER', createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2) },
                    { content: 'Claro Bernardo, tenemos planes Basic, Pro y Enterprise. ¿Cual te interesa?', sender: 'AGENT', createdAt: new Date(Date.now() - 1000 * 60 * 60 * 1.9) },
                    { content: 'El plan Pro suena bien, ¿qué precio tiene?', sender: 'USER', createdAt: new Date(Date.now() - 1000 * 60 * 5) }
                ]
            }
        }
    });

    // 2. AssistAI Web Chat
    const webSessionId = 'web-session-001';
    await prisma.conversation.upsert({
        where: { sessionId: webSessionId },
        update: { updatedAt: new Date() },
        create: {
            sessionId: webSessionId,
            platform: 'ASSISTAI',
            status: 'ACTIVE',
            customerName: 'Web Visitor',
            customerContact: 'visitor@web.com',
            messages: {
                create: [
                    { content: 'Buenas tardes', sender: 'USER', createdAt: new Date(Date.now() - 1000 * 60 * 30) },
                    { content: '¡Hola! Soy el asistente virtual. ¿En qué puedo ayudarte hoy?', sender: 'AGENT', createdAt: new Date(Date.now() - 1000 * 60 * 29) },
                    { content: 'Necesito soporte técnico con mi factura', sender: 'USER', createdAt: new Date(Date.now() - 1000 * 60 * 10) }
                ]
            }
        }
    });

    // 3. Instagram DM (Cerrado)
    const igSessionId = 'ig-user-002';
    await prisma.conversation.upsert({
        where: { sessionId: igSessionId },
        update: { updatedAt: new Date() },
        create: {
            sessionId: igSessionId,
            platform: 'INSTAGRAM',
            status: 'RESOLVED',
            customerName: '@insta_fan',
            customerContact: 'instagram.com/insta_fan',
            messages: {
                create: [
                    { content: 'Me encanta su producto 🔥', sender: 'USER', createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24) },
                    { content: '¡Muchas gracias! Nos alegra escucharlo ❤️', sender: 'AGENT', createdAt: new Date(Date.now() - 1000 * 60 * 60 * 23) }
                ]
            }
        }
    });

    console.log('✅ Chats seeded successfully!');
    console.log('👉 Go to http://localhost:3003/inbox to see them.');
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
