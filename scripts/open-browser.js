#!/usr/bin/env node

const open = require('open');

// Esperar 8 segundos para que los servidores estén listos
setTimeout(() => {
  console.log('\n🌐 Abriendo navegador en http://localhost:3000\n');
  open('http://localhost:3000').catch(err => {
    console.error('No se pudo abrir el navegador automáticamente:', err.message);
    console.log('Por favor abre manualmente: http://localhost:3000');
  });
}, 8000);
