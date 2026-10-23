import path from 'node:path';
import crypto from 'node:crypto';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import { checkDatabaseConnection } from './db.js';
import { authenticate } from './modules/auth/auth.middleware.js';
import { authRouter } from './modules/auth/auth.controller.js';
import { staffRouter } from './modules/staff/staff.controller.js';
import { tenantRouter } from './modules/tenant/tenant.controller.js';
import { menuRouter, publicMenuRouter } from './modules/menu/menu.controller.js';
import { tablesRouter } from './modules/tables/tables.controller.js';
import { visitsRouter } from './modules/visits/visits.controller.js';
import { publicTableRouter } from './modules/guest/public-table.controller.js';
import { guestRouter } from './modules/guest/guest.controller.js';
import { ordersRouter } from './modules/orders/orders.controller.js';
import { waiterRouter } from './modules/waiter/waiter.controller.js';
import { kdsRouter } from './modules/kds/kds.controller.js';
import { realtimeRouter, guestRealtimeRouter } from './modules/realtime/realtime.controller.js';
import { billingRouter } from './modules/billing/billing.controller.js';
import { reportsRouter } from './modules/reports/reports.controller.js';
import { settingsRouter } from './modules/settings/settings.controller.js';
import { auditRouter } from './modules/audit/audit.controller.js';
import { platformRouter } from './modules/platform/platform.controller.js';
import { outboxService } from './modules/realtime/outbox.service.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 4000;

// Dynamic CORS configuration
const defaultOrigins = ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:5173'];
const configuredOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean)
  : [];
if (process.env.FRONTEND_URL) {
  configuredOrigins.push(process.env.FRONTEND_URL.trim());
}
const allowedOrigins = Array.from(new Set([...defaultOrigins, ...configuredOrigins]));

app.use(
  cors({
    origin: (requestOrigin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, server-to-server)
      if (!requestOrigin || allowedOrigins.includes(requestOrigin)) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    credentials: true,
  })
);
app.use(cookieParser());
app.use(express.json());

// Request Correlation & Monitoring Middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  const requestId = (req.headers['x-request-id'] as string) || `req_${crypto.randomUUID()}`;
  res.setHeader('X-Request-Id', requestId);
  (req as any).requestId = requestId;

  res.on('finish', () => {
    const duration = Date.now() - start;
    const cleanUrl = req.originalUrl.split('?')[0];

    // Sekin so'rovlar nazorati (>1000ms)
    if (duration > 1000) {
      console.warn(`[SLOW_QUERY_ALERT] [${requestId}] ${req.method} ${cleanUrl} ${res.statusCode} ${duration}ms`);
    } else if (process.env.NODE_ENV === 'development') {
      console.log(`[${new Date().toISOString()}] [${requestId}] ${req.method} ${cleanUrl} ${res.statusCode} ${duration}ms`);
    }
  });

  next();
});

// Autentifikatsiya kontekstini yuklash (Cookies yoki Bearer)
app.use(authenticate);

// 1. Health & Ready Endpoints
app.get(['/health', '/api/health'], (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    data: {
      status: 'healthy',
      uptimeSeconds: process.uptime(),
      timestamp: new Date().toISOString(),
    },
    meta: {
      timestamp: new Date().toISOString(),
      requestId: `req_${Date.now()}`,
    },
  });
});

app.get(['/ready', '/api/ready'], async (_req: Request, res: Response) => {
  const isDbReady = await checkDatabaseConnection();
  if (isDbReady) {
    res.status(200).json({
      success: true,
      data: {
        ready: true,
        database: 'connected (PostgreSQL)',
        timestamp: new Date().toISOString(),
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: `req_${Date.now()}`,
      },
    });
  } else {
    res.status(503).json({
      success: false,
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'Ma\'lumotlar bazasi bilan aloqa mavjud emas',
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: `req_${Date.now()}`,
      },
    });
  }
});

// Static file serving for uploads (safe generated image keys)
app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads')));

// 2. Modul Routerlari
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/staff', staffRouter);
app.use('/api/v1/restaurants', tenantRouter);
app.use('/api/v1/restaurants', menuRouter);
app.use('/api/v1/restaurants', tablesRouter);
app.use('/api/v1/restaurants', visitsRouter);
app.use('/api/v1/public', publicMenuRouter);
app.use('/api/v1/public', publicTableRouter);
app.use('/api/v1/guest', guestRouter);
app.use('/api/v1/guest', ordersRouter);
app.use('/api/v1/guest', guestRealtimeRouter);
app.use('/api/v1/restaurants', waiterRouter);
app.use('/api/v1/restaurants', kdsRouter);
app.use('/api/v1/restaurants', realtimeRouter);
app.use('/api/v1/restaurants', billingRouter);
app.use('/api/v1/restaurants/:restaurantId/reports', reportsRouter);
app.use('/api/v1/restaurants/:restaurantId/settings', settingsRouter);
app.use('/api/v1/restaurants/:restaurantId/audit', auditRouter);
app.use('/api/v1/restaurants/:restaurantId/staff', staffRouter);
app.use('/api/v1/platform', platformRouter);
app.use('/api/v1/kds', kdsRouter);

// 3. Fallback 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'So\'ralgan API endpoint mavjud emas',
    },
    meta: {
      timestamp: new Date().toISOString(),
      requestId: `req_${Date.now()}`,
    },
  });
});

// 4. Global Error handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled server error:', err);
  const status = err.statusCode || 500;
  res.status(status).json({
    success: false,
    error: {
      code: err.code || 'INTERNAL_SERVER_ERROR',
      message: err.message || 'Serverda kutilmagan xatolik yuz berdi',
      details: err.details,
    },
    meta: {
      timestamp: new Date().toISOString(),
      requestId: `req_${Date.now()}`,
    },
  });
});

export const server = app
  .listen(port, () => {
    console.log(`[MENUREST API] Server running on port ${port} in ${process.env.NODE_ENV || 'development'} mode`);
    // Start Transactional Outbox background processing
    outboxService.start();
  })
  .on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`[MENUREST API] Port ${port} band (server allaqachon ishlamoqda), yangi tinglovchi o'tkazib yuborildi.`);
    } else {
      throw err;
    }
  });

export default app;
