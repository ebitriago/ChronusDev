import { prisma } from './src/db';

async function main() {
    const adminEmail = 'admin@chronus.com';
    const altAdminEmail = 'admin@chronuscrm.com';

    console.log(`🔍 Buscando usuario admin (${adminEmail} o ${altAdminEmail})...`);

    const user = await prisma.user.findFirst({
        where: {
            email: { in: [adminEmail, altAdminEmail] }
        },
        include: {
            memberships: {
                include: { organization: true }
            }
        }
    });

    if (!user) {
        console.error('❌ Usuario admin no encontrado.');
        const allUsers = await prisma.user.findMany({ select: { email: true } });
        console.log('Usuarios disponibles:', allUsers.map(u => u.email));
        return;
    }

    console.log(`✅ Usuario encontrado: ${user.email}`);

    if (user.memberships.length === 0) {
        console.error('❌ El usuario no pertenece a ninguna organización.');
        return;
    }

    const org = user.memberships[0].organization;
    console.log(`🏢 Organización: ${org.name} (${org.id})`);

    // Update SMTP Config
    const smtpConfig = {
        host: 'smtp.gmail.com',
        port: 587,
        user: 'hello@assistai.lat',
        pass: 'ypkz gvoh hztj lzrz',
        from: 'hello@assistai.lat'
    };

    await prisma.organization.update({
        where: { id: org.id },
        data: {
            smtpConfig
        }
    });

    console.log('✅ Configuración SMTP actualizada exitosamente:');
    console.log(JSON.stringify(smtpConfig, null, 2));
}

main()
    .catch(e => {
        console.error('❌ Error:', e);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
