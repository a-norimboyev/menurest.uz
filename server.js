const http = require('http');
const app = require('./src/app');
const socketService = require('./src/services/socket.service');
const { PORT } = require('./src/config/constants');

// Dastlabki ma'lumotlarni yuklash (seed)
try {
  require('./seed');
} catch (e) {
  console.log('Seed yuklanmadi yoki allaqachon mavjud:', e.message);
}

const server = http.createServer(app);

// Real-Time Socket.io xizmatini ulash
socketService.init(server);

// Serverni ishga tushirish
server.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 QR Menyu 2.0 (Clean Architecture & Real-Time) faol!`);
  console.log(`📍 Asosiy platforma:     http://localhost:${PORT}`);
  console.log(`📱 Mijoz namunasi:       http://localhost:${PORT}/r/rayhon?table=1`);
  console.log(`👨‍🍳 Restoran Admin:       http://localhost:${PORT}/admin`);
  console.log(`👑 Super Admin:          http://localhost:${PORT}/super-admin`);
  console.log(`⚡ WebSocket Server:     Faol (Socket.io)`);
  console.log(`====================================================`);
});

process.on('uncaughtException', (err) => {
  console.error('❌ Kutilmagan xato (server davom etmoqda):', err.message);
});
process.on('unhandledRejection', (reason) => {
  console.error('❌ Hal qilinmagan promise (server davom etmoqda):', reason);
});

module.exports = server;

