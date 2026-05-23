import dotenv from 'dotenv'
import express from 'express'
import cors from 'cors'
import pg from 'pg'

dotenv.config()

const { Pool } = pg
const PORT = Number(process.env.PORT || 8787)
const DATABASE_URL = process.env.DATABASE_URL || ''
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || ''

if (!DATABASE_URL) {
  console.error('DATABASE_URL is required in backend/.env')
  process.exit(1)
}

if (!FRONTEND_ORIGIN) {
  console.error('FRONTEND_ORIGIN is required in backend/.env (comma-separated allowed origins)')
  process.exit(1)
}

const allowedOrigins = FRONTEND_ORIGIN
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

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
