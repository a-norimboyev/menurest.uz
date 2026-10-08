const express = require('express');
const cors = require('cors');
const path = require('path');
const { PUBLIC_DIR } = require('./config/constants');
const { globalLimiter } = require('./middlewares/rateLimiter.middleware');
const errorHandler = require('./middlewares/error.middleware');

const publicRoutes = require('./routes/public.routes');
const clientRoutes = require('./routes/client.routes');
const kdsRoutes = require('./routes/kds.routes');
const adminRoutes = require('./routes/admin.routes');
const superRoutes = require('./routes/super.routes');
const waiterRoutes = require('./routes/waiter.routes');
const leadController = require('./controllers/lead.controller');
const { leadLimiter } = require('./middlewares/rateLimiter.middleware');

const app = express();

// Global middleware lar
app.use(globalLimiter);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(PUBLIC_DIR));

// API Marshrutlari
app.use('/api/public', publicRoutes);
app.use('/api/r', clientRoutes);
app.use('/api/kds', kdsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/super', superRoutes);
app.use('/api/waiter', waiterRoutes);
app.post('/api/leads', leadLimiter, leadController.createLead);

// HTML Sahifalar Routing
app.get('/kitchen', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'kitchen', 'index.html'));
});

app.get('/r/:slug', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'r', 'index.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'admin', 'index.html'));
});

app.get('/super-admin', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'super-admin', 'index.html'));
});

app.get('/', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

// Xatoliklarni markaziy ushlash
app.use(errorHandler);

module.exports = app;
