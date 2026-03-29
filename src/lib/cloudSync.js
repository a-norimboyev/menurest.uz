const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '')
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || ''
const SYNC_USER_ID = import.meta.env.VITE_PLANNER_SYNC_USER_ID || 'Azizjon'
const AUTH_SYNC_USER_KEY = 'planner-auth-user-id-v1'
const BACKEND_SYNC_URL = (import.meta.env.VITE_SYNC_BACKEND_URL || '').replace(/\/+$/, '')
const REQUEST_TIMEOUT_MS = 8000

function toMs(value) {
  const asNumber = Number(value)
  if (!Number.isNaN(asNumber) && asNumber > 0) return asNumber
  const parsed = Date.parse(String(value || ''))
  return Number.isNaN(parsed) ? 0 : parsed
}

function getHeaders() {
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
  }
}

function getSyncUserId() {
  if (typeof window === 'undefined') return SYNC_USER_ID

  const fromSession = window.sessionStorage.getItem(AUTH_SYNC_USER_KEY)
  const normalized = typeof fromSession === 'string' ? fromSession.trim() : ''
  return normalized || SYNC_USER_ID
}

function isBackendSyncEnabled() {
  return Boolean(BACKEND_SYNC_URL && getSyncUserId())
}

function isSupabaseSyncEnabled() {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY && getSyncUserId())
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
  return isBackendSyncEnabled() || isSupabaseSyncEnabled()
}

export async function loadCloudSnapshot() {
  if (!isCloudSyncEnabled()) return null
  const syncUserId = getSyncUserId()

  if (isBackendSyncEnabled()) {
    const endpoint = `${BACKEND_SYNC_URL}/sync/${encodeURIComponent(syncUserId)}`
    const response = await fetchWithTimeout(endpoint, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (response.status === 404) return null
    if (!response.ok) {
      throw new Error(`Backend read failed: ${response.status}`)
    }

    const data = await response.json()
    if (!data || typeof data !== 'object' || !data.payload) return null

    return {
      payload: data.payload,
      timestamp: toMs(data.updatedAt),
    }
  }

  const endpoint = `${SUPABASE_URL}/rest/v1/planner_sync?user_id=eq.${encodeURIComponent(syncUserId)}&select=payload,updated_at&limit=1`
  const response = await fetchWithTimeout(endpoint, {
    method: 'GET',
    headers: getHeaders(),
  })

  if (!response.ok) {
    throw new Error(`Cloud read failed: ${response.status}`)
  }

  const rows = await response.json()
  if (!Array.isArray(rows) || rows.length === 0) return null

  const row = rows[0]
  return {
    ...row,
    timestamp: Math.max(toMs(row?.payload?.updatedAt), toMs(row?.updated_at)),
  }
}

export async function saveCloudSnapshot(payload, lastKnownTimestamp = 0) {
  if (!isCloudSyncEnabled()) return null
  const syncUserId = getSyncUserId()

  if (isBackendSyncEnabled()) {
    const endpoint = `${BACKEND_SYNC_URL}/sync/${encodeURIComponent(syncUserId)}`
    const response = await fetchWithTimeout(endpoint, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        payload,
        lastKnownTimestamp,
      }),
    })

    if (response.status === 409) {
      const conflict = await response.json()
      return {
        status: 'conflict',
        remote: {
          payload: conflict?.remote?.payload,
          timestamp: toMs(conflict?.remote?.updatedAt),
        },
      }
    }

    if (!response.ok) {
      throw new Error(`Backend write failed: ${response.status}`)
    }

    const saved = await response.json()
    return {
      status: 'saved',
      row: saved,
    }
  }

  const remote = await loadCloudSnapshot()
  const remoteTimestamp = Number(remote?.timestamp || 0)

  if (remote && remoteTimestamp > Number(lastKnownTimestamp || 0)) {
    return { status: 'conflict', remote }
  }

  const endpoint = `${SUPABASE_URL}/rest/v1/planner_sync?on_conflict=user_id`
  const response = await fetchWithTimeout(endpoint, {
    method: 'POST',
    headers: {
      ...getHeaders(),
      Prefer: 'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify([
      {
        user_id: syncUserId,
        payload,
        updated_at: new Date().toISOString(),
      },
    ]),
  })

  if (!response.ok) {
    throw new Error(`Cloud write failed: ${response.status}`)
  }

  const rows = await response.json()
  return {
    status: 'saved',
    row: Array.isArray(rows) && rows[0] ? rows[0] : null,
  }
}
