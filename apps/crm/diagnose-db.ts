
import pg from 'pg';

const passwords = ['postgres'];
const user = 'postgres';
const dbName = 'chronuscrm';
const host = '127.0.0.1'; // Force IPv4
const ports = [5434];

async function check() {
    console.log(`🕵️ Buscando credenciales para ${user}@${host}/${dbName}...`);

    for (const port of ports) {
        console.log(`\n------------------------------------------------`);
        console.log(`📡 Probando PUERTO ${port}:`);
        console.log(`------------------------------------------------`);
        for (const pass of passwords) {
            process.stdout.write(`  Password: "${pass}" ... `);
            const pool = new pg.Pool({
                connectionString: `postgresql://${user}:${pass}@${host}:${port}/${dbName}?schema=public`,
                connectionTimeoutMillis: 5000
            });

            try {
                const client = await pool.connect();
                console.log('✅ ÉXITO DE CONEXIÓN NATIVA!');
                const res = await client.query('SELECT NOW()');
                console.log('🕒 DB Time:', res.rows[0]);
                client.release();
                await pool.end();
                process.exit(0);
            } catch (e: any) {
                console.log(`❌ Falló (${e.message})`);
                await pool.end();
            }
        }
    }
    console.log('\n⚠️ Ninguna contraseña funcionó en ningún puerto.');
    process.exit(1);
}

check();
