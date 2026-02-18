
async function main() {
    const CRM_URL = 'http://127.0.0.1:3002';
    const email = 'admin@chronuscrm.com'; // Try this one first based on task logs
    const password = 'password123'; // Common seed password, if not we try others

    console.log(`🔑 Intentando login en ${CRM_URL} con ${email}...`);

    try {
        const loginRes = await fetch(`${CRM_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        if (!loginRes.ok) {
            const err = await loginRes.text();
            throw new Error(`Login failed: ${loginRes.status} ${err}`);
        }

        const { token, user } = await loginRes.json();
        console.log(`✅ Login exitoso para ${user.name} (${user.email})`);

        // Configure SMTP
        console.log('📧 Configurando SMTP...');
        const smtpConfig = {
            host: 'smtp.gmail.com',
            port: 587,
            user: 'hello@assistai.lat',
            pass: 'ypkz gvoh hztj lzrz',
            from: 'hello@assistai.lat'
        };

        const configRes = await fetch(`${CRM_URL}/settings/smtp`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(smtpConfig)
        });

        if (!configRes.ok) {
            const err = await configRes.text();
            throw new Error(`SMTP Config failed: ${configRes.status} ${err}`);
        }

        const result = await configRes.json();
        console.log('✅ Configuración SMTP guardada exitosamente:');
        console.log(JSON.stringify(result, null, 2));

    } catch (error) {
        console.error('❌ Error:', error.message);
        // Try alternate user if first fails?
        if (error.message.includes('Login failed')) {
            console.log('⚠️ Pruebe con admin@chronus.com / admin ...');
            // logic for retry could be added here manually
        }
    }
}

main();
