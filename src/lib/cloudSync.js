const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '')
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || ''
const SYNC_USER_ID = import.meta.env.VITE_PLANNER_SYNC_USER_ID || ''
const REQUEST_TIMEOUT_MS = 8000

function getHeaders() {
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
  }
}

async function fetchWithTimeout(url, options) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    return await fetch(url, {
      ...options,
      cache: 'no-store',
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timer)
  }
}

export function isCloudSyncEnabled() {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY && SYNC_USER_ID)
}

export async function loadCloudSnapshot() {
  if (!isCloudSyncEnabled()) return null

  const endpoint = `${SUPABASE_URL}/rest/v1/planner_sync?user_id=eq.${encodeURIComponent(SYNC_USER_ID)}&select=payload,updated_at&limit=1`
  const response = await fetchWithTimeout(endpoint, {
    method: 'GET',
    headers: getHeaders(),
  })

  if (!response.ok) {
    throw new Error(`Cloud read failed: ${response.status}`)
  }

  const rows = await response.json()
  if (!Array.isArray(rows) || rows.length === 0) return null

  return rows[0]
}

export async function saveCloudSnapshot(payload) {
  if (!isCloudSyncEnabled()) return null

  const endpoint = `${SUPABASE_URL}/rest/v1/planner_sync?on_conflict=user_id`
  const response = await fetchWithTimeout(endpoint, {
    method: 'POST',
    headers: {
      ...getHeaders(),
      Prefer: 'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify([
      {
        user_id: SYNC_USER_ID,
        payload,
        updated_at: new Date().toISOString(),
      },
    ]),
  })

  if (!response.ok) {
    throw new Error(`Cloud write failed: ${response.status}`)
  }

  const rows = await response.json()
  return Array.isArray(rows) && rows[0] ? rows[0] : null
}
