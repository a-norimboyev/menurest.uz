import { spawn } from 'node:child_process';

console.log('🚀 Menurest.uz KASSA moduli ishga tushirilmoqda...\n');

const isWin = process.platform === 'win32';
const npmCmd = isWin ? 'npm.cmd' : 'npm';

// 1. API serverini ishga tushirish (Port 4000)
const api = spawn(npmCmd, ['run', 'dev', '--workspace=@menurest/api'], {
  stdio: 'inherit',
  shell: true,
});

// 2. Web frontendni ishga tushirish (Port 3000)
const web = spawn(npmCmd, ['run', 'dev', '--workspace=@menurest/web'], {
  stdio: 'inherit',
  shell: true,
});

console.log('====================================================');
console.log('💰 KASSA TIZIMI TAYYOR!');
console.log('👉 Kassa oynasini ochish: http://localhost:3000/#cashier');
console.log('🔑 Demo kassa login: +998911000003 / +998911000003');
console.log('====================================================\n');

function shutdown() {
  console.log('\nTo\'xtatilmoqda...');
  try { api.kill(); } catch {}
  try { web.kill(); } catch {}
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
