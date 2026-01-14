#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');
const open = require('open');

console.log('🚀 Iniciando ChronusDev...\n');
console.log('📦 Backend: http://localhost:3001');
console.log('🎨 Frontend: http://localhost:3000\n');

// Iniciar backend
console.log('📦 Iniciando backend...');
const backend = spawn('npm', ['run', 'dev'], {
  cwd: path.join(__dirname, '../apps/backend'),
  shell: true,
  stdio: 'inherit',
});

// Iniciar frontend después de un pequeño delay
setTimeout(() => {
  console.log('🎨 Iniciando frontend...\n');
  const frontend = spawn('npm', ['run', 'dev'], {
    cwd: path.join(__dirname, '../apps/frontend'),
    shell: true,
    stdio: 'inherit',
  });

  // Abrir navegador después de 8 segundos
  setTimeout(() => {
    console.log('\n🌐 Abriendo navegador en http://localhost:3000\n');
    open('http://localhost:3000').catch(err => {
      console.log('⚠️  No se pudo abrir automáticamente. Abre manualmente: http://localhost:3000');
    });
  }, 8000);

  // Manejar cierre
  const cleanup = () => {
    console.log('\n🛑 Deteniendo servidores...');
    backend.kill('SIGTERM');
    frontend.kill('SIGTERM');
    setTimeout(() => {
      backend.kill('SIGKILL');
      frontend.kill('SIGKILL');
      process.exit();
    }, 2000);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}, 2000);

// Manejar errores
backend.on('error', (err) => {
  console.error('❌ Error al iniciar backend:', err);
  process.exit(1);
});
