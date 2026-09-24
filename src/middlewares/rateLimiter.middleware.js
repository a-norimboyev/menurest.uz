const rateLimit = require('express-rate-limit');

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: { success: false, message: "Juda ko'p so'rov yuborildi, iltimos keyinroq urinib ko'ring." }
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: "Kirish urinishlari ko'payib ketdi. Iltimos 15 daqiqadan so'ng urinib ko'ring." }
});

const orderLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { success: false, message: "Iltimos, so'rovlarni juda tez yubormang." }
});

const leadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: { success: false, message: "Arizalar soni cheklandi. Iltimos biroz kuting." }
});

module.exports = {
  globalLimiter,
  loginLimiter,
  orderLimiter,
  leadLimiter
};
