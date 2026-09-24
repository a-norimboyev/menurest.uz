const multer = require('multer');

function errorHandler(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ success: false, message: "Fayl hajmi juda katta! Maksimal 3MB ruxsat etilgan." });
    }
    return res.status(400).json({ success: false, message: err.message });
  }

  if (err) {
    console.error("Server xatoligi:", err);
    return res.status(err.status || 500).json({
      success: false,
      message: err.message || "Ichki server xatoligi yuz berdi"
    });
  }

  next();
}

module.exports = errorHandler;
