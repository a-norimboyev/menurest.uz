import dotenv from 'dotenv'
import express from 'express'
import cors from 'cors'
import pg from 'pg'

dotenv.config()

const { Pool } = pg
const PORT = Number(process.env.PORT || 8787)
const DATABASE_URL = process.env.DATABASE_URL || ''
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || ''
const APP_LOGIN_USERNAME = process.env.APP_LOGIN_USERNAME || ''
const APP_LOGIN_PASSWORD = process.env.APP_LOGIN_PASSWORD || ''

const LOGIN_WINDOW_MS = 10 * 60 * 1000
const LOGIN_MAX_ATTEMPTS = 8
const loginAttempts = new Map()

if (!DATABASE_URL) {
  console.error('DATABASE_URL is required in backend/.env')
  process.exit(1)
}

if (!FRONTEND_ORIGIN) {
  console.error('FRONTEND_ORIGIN is required in backend/.env (comma-separated allowed origins)')
  process.exit(1)
}

if (!APP_LOGIN_USERNAME || !APP_LOGIN_PASSWORD) {
  console.error('APP_LOGIN_USERNAME and APP_LOGIN_PASSWORD are required in backend/.env')
  process.exit(1)
}

const allowedOrigins = FRONTEND_ORIGIN
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for']
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim()
  }
  return req.ip || req.socket?.remoteAddress || 'unknown'
}

function isRateLimited(ip) {
  const now = Date.now()
  const current = loginAttempts.get(ip)
  if (!current) return false
  if (now - current.firstAttemptAt > LOGIN_WINDOW_MS) {
    loginAttempts.delete(ip)
    return false
  }
  return current.count >= LOGIN_MAX_ATTEMPTS
}

function registerFailedAttempt(ip) {
  const now = Date.now()
  const current = loginAttempts.get(ip)

  if (!current || now - current.firstAttemptAt > LOGIN_WINDOW_MS) {
    loginAttempts.set(ip, { count: 1, firstAttemptAt: now })
    return
  }

  loginAttempts.set(ip, {
    count: current.count + 1,
    firstAttemptAt: current.firstAttemptAt,
  })
}

function clearAttempts(ip) {
  loginAttempts.delete(ip)
}

setInterval(() => {
  const now = Date.now()
  for (const [ip, value] of loginAttempts.entries()) {
    if (now - value.firstAttemptAt > LOGIN_WINDOW_MS) {
      loginAttempts.delete(ip)
    }
  }
}, LOGIN_WINDOW_MS).unref()

const pool = new Pool({
  connectionString: DATABASE_URL,
})

async function ensureSchema() {
  await pool.query(`
    create table if not exists planner_sync (
      user_id text primary key,
      payload jsonb not null,
      updated_at timestamptz not null default now()
    )
  `)
}

const app = express()
app.set('trust proxy', true)
app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true)
      if (allowedOrigins.includes(origin)) return callback(null, true)
      return callback(new Error('CORS blocked'))
    },
  }),
)
app.use(express.json({ limit: '2mb' }))

app.get('/health', async (_req, res) => {
  res.json({ ok: true })
})

app.post('/auth/login', (req, res) => {
  const { username = '', password = '' } = req.body || {}
  const ip = getClientIp(req)

  if (isRateLimited(ip)) {
    return res.status(429).json({
      ok: false,
      message: 'Too many attempts. Try again later.',
      retryAfterSec: Math.floor(LOGIN_WINDOW_MS / 1000),
    })
  }

  const ok = username.trim() === APP_LOGIN_USERNAME && password === APP_LOGIN_PASSWORD
  if (!ok) {
    registerFailedAttempt(ip)
    return res.status(401).json({ ok: false, message: 'Invalid credentials' })
  }

  clearAttempts(ip)
  return res.json({ ok: true })
})

app.get('/sync/:userId', async (req, res) => {
  const { userId } = req.params

  const result = await pool.query(
    `
      select payload, extract(epoch from updated_at) * 1000 as updated_ms
      from planner_sync
      where user_id = $1
      limit 1
    `,
    [userId],
  )

  if (result.rowCount === 0) {
    return res.status(404).json({ message: 'Not found' })
  }

  const row = result.rows[0]
  return res.json({
    payload: row.payload,
    updatedAt: Number(row.updated_ms || 0),
  })
})

app.put('/sync/:userId', async (req, res) => {
  const { userId } = req.params
  const { payload, lastKnownTimestamp = 0 } = req.body || {}

  if (!payload || typeof payload !== 'object') {
    return res.status(400).json({ message: 'Invalid payload' })
  }

  const existing = await pool.query(
    `
      select payload, extract(epoch from updated_at) * 1000 as updated_ms
      from planner_sync
      where user_id = $1
      limit 1
    `,
    [userId],
  )

  const remoteTimestamp = existing.rowCount > 0 ? Number(existing.rows[0].updated_ms || 0) : 0

  if (remoteTimestamp > Number(lastKnownTimestamp || 0)) {
    return res.status(409).json({
      message: 'Conflict',
      remote: {
        payload: existing.rows[0].payload,
        updatedAt: remoteTimestamp,
      },
    })
  }

  const saved = await pool.query(
    `
      insert into planner_sync (user_id, payload, updated_at)
      values ($1, $2::jsonb, now())
      on conflict (user_id)
      do update set
        payload = excluded.payload,
        updated_at = now()
      returning extract(epoch from updated_at) * 1000 as updated_ms
    `,
    [userId, JSON.stringify(payload)],
  )

  return res.json({
    saved: true,
    updatedAt: Number(saved.rows[0].updated_ms || 0),
  })
})

app.use((error, _req, res, _next) => {
  console.error(error)
  res.status(500).json({ message: 'Internal server error' })
})

ensureSchema()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Sync backend running on http://localhost:${PORT}`)
    })
  })
  .catch((error) => {
    console.error('Failed to start backend:', error)
    process.exit(1)
  })
