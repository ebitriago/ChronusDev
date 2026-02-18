/**
 * Script para sincronizar organizaciones entre CRM y ChronusDev
 * 
 * Uso: ts-node scripts/sync-organizations.ts
 */
import { prisma } from '../src/db.js';

async function main() {
    console.log('=== Verificación de Organizaciones CRM ↔ ChronusDev ===\n');

    // 1. Listar organizaciones en ChronusDev
    const devOrgs = await prisma.organization.findMany({
        include: {
            members: {
                include: { user: { select: { id: true, email: true, name: true } } }
            }
        }
    });

    console.log('📦 Organizaciones en ChronusDev:');
    console.log('─'.repeat(60));

    for (const org of devOrgs) {
        console.log(`  ID: ${org.id}`);
        console.log(`  Nombre: ${org.name}`);
        console.log(`  Slug: ${org.slug}`);
        console.log(`  CRM vinculado: ${org.crmOrganizationId || '❌ NO VINCULADA'}`);
        console.log(`  Miembros: ${org.members.map(m => m.user.email).join(', ') || 'ninguno'}`);
        console.log('─'.repeat(60));
    }

    // 2. Mostrar instrucciones
    console.log('\n📋 Para vincular una organización de CRM:\n');
    console.log('   1. Obtén el ID de tu organización del CRM');
    console.log('   2. Ejecuta este comando en psql o pgAdmin:');
    console.log('');
    console.log('   UPDATE "Organization"');
    console.log('   SET "crmOrganizationId" = \'<ID_DE_CRM>\'');
    console.log('   WHERE id = \'<ID_DE_CHRONUSDEV>\';');
    console.log('');
    console.log('   O usa la API:');
    console.log('   PUT /organizations/<id>/link-crm { "crmOrganizationId": "..." }');
    console.log('');

    // 3. Sugerir vinculación automática si hay solo una org
    if (devOrgs.length === 1 && !devOrgs[0].crmOrganizationId) {
        console.log('⚡ Pista: Solo tienes una organización. Usa este endpoint para vincular:');
        console.log(`   POST http://localhost:3001/organizations/${devOrgs[0].id}/link-crm`);
    }
}

main()
    .then(() => process.exit(0))
    .catch(e => {
        console.error('Error:', e);
        process.exit(1);
    });
