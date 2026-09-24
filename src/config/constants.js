const path = require('path');

module.exports = {
  PORT: process.env.PORT || 3000,
  JWT_SECRET: process.env.JWT_SECRET || 'qr-menyu-super-secret-production-key-2026',
  DATA_DIR: path.join(__dirname, '..', '..', 'data'),
  UPLOADS_DIR: path.join(__dirname, '..', '..', 'public', 'uploads'),
  PUBLIC_DIR: path.join(__dirname, '..', '..', 'public'),
  MAX_FILE_SIZE: 3 * 1024 * 1024, // 3MB
  ALLOWED_IMAGE_MIMES: ['image/jpeg', 'image/png', 'image/webp']
};
