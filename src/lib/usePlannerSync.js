import { useEffect, useRef, useState } from 'react'
import { loadCloudSnapshot, saveCloudSnapshot } from './cloudSync'
import { buildSyncPayload, persistSyncTimestamp } from './plannerSync'
import { SYNC_PULL_INTERVAL_MS, SYNC_PUSH_DEBOUNCE_MS, SYNC_TIMESTAMP_KEY } from './plannerState'

export function usePlannerSync({
  cloudSyncEnabled,
  applyRemotePayload,
  theme,
  dateId,
  state,
  carrySettings,
  carryBacklog,
  carryLog,
  recurringTemplates,
  recurringDone,
  dailyQuotes,
}) {
  const [isOnline, setIsOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine))
  const syncReadyRef = useRef(!cloudSyncEnabled)
  const syncTimerRef = useRef(null)
  const skipNextPushRef = useRef(false)
  const lastSyncedTimestampRef = useRef(Number(localStorage.getItem(SYNC_TIMESTAMP_KEY) || 0))

  useEffect(() => {
    const onOnline = () => setIsOnline(true)
    const onOffline = () => setIsOnline(false)

    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)

    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function pullFromCloud() {
      if (!cloudSyncEnabled) {
        syncReadyRef.current = true
        return
      }

      if (!navigator.onLine) {
        syncReadyRef.current = true
        return
      }

      try {
        const localTimestamp = Number(localStorage.getItem(SYNC_TIMESTAMP_KEY) || 0)
        const remoteRow = await loadCloudSnapshot()
        const remotePayload = remoteRow?.payload && typeof remoteRow.payload === 'object' ? remoteRow.payload : null
        const remoteTimestamp = Number(remotePayload?.updatedAt || 0)

        if (!cancelled && remotePayload && remoteTimestamp > Math.max(localTimestamp, lastSyncedTimestampRef.current)) {
          skipNextPushRef.current = true
          applyRemotePayload(remotePayload)
        }

        const latestTimestamp = Math.max(localTimestamp, remoteTimestamp, lastSyncedTimestampRef.current)
        lastSyncedTimestampRef.current = latestTimestamp
        if (latestTimestamp > 0) {
          persistSyncTimestamp(latestTimestamp)
        }
      } catch {
        return null
      } finally {
        if (!cancelled) {
          syncReadyRef.current = true
        }
      }
    }

    pullFromCloud()
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        pullFromCloud()
      }
    }, SYNC_PULL_INTERVAL_MS)
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        pullFromCloud()
      }
    }

    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [applyRemotePayload, cloudSyncEnabled])

  useEffect(() => {
    if (!cloudSyncEnabled || !syncReadyRef.current) return
    if (!isOnline) return

    if (skipNextPushRef.current) {
      skipNextPushRef.current = false
      return
    }

    if (syncTimerRef.current) {
      clearTimeout(syncTimerRef.current)
    }

    syncTimerRef.current = setTimeout(() => {
      const payload = buildSyncPayload({
        theme,
        dateId,
        state,
        carrySettings,
        carryBacklog,
        carryLog,
        recurringTemplates,
        recurringDone,
        dailyQuotes,
      })

      saveCloudSnapshot(payload, lastSyncedTimestampRef.current)
        .then((result) => {
          if (result?.status === 'conflict' && result.remote?.payload) {
            skipNextPushRef.current = true
            applyRemotePayload(result.remote.payload)
            const remoteTimestamp = Number(result.remote.timestamp || 0)
            lastSyncedTimestampRef.current = remoteTimestamp
            persistSyncTimestamp(remoteTimestamp)
            return
          }

          lastSyncedTimestampRef.current = payload.updatedAt
          persistSyncTimestamp(payload.updatedAt)
        })
        .catch(() => null)
    }, SYNC_PUSH_DEBOUNCE_MS)

    return () => {
      if (syncTimerRef.current) {
        clearTimeout(syncTimerRef.current)
      }
    }
  }, [applyRemotePayload, cloudSyncEnabled, isOnline, theme, dateId, state, recurringTemplates, recurringDone, dailyQuotes, carrySettings, carryBacklog, carryLog])
}