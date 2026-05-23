import {
  CARRY_BACKLOG_KEY,
  CARRY_LOG_KEY,
  CARRY_SETTINGS_KEY,
  SYNC_TIMESTAMP_KEY,
  getDailyMotivation,
  getHistory,
  getRecurringDoneStorageKey,
  getWeekStorageKey,
  loadRecurringDone,
  loadWeekState,
  resolveTheme,
  saveDailyQuotes,
  saveHistory,
  saveRecurringTemplates,
} from './plannerState'

function normalizeIncomingCarrySettings(value) {
  return {
    enabled: value?.enabled !== false,
    limit: Math.min(10, Math.max(1, Number.parseInt(String(value?.limit ?? 3), 10) || 3)),
  }
}

export function applyRemotePayloadToApp({
  remotePayload,
  dateId,
  weekId,
  recurringTemplatesLength,
  setTheme,
  setRecurringTemplates,
  setDailyQuotes,
  setTodayMotivation,
  setCarrySettings,
  setCarryBacklog,
  setCarryLog,
  setState,
  setRecurringDone,
}) {
  if (typeof remotePayload?.theme === 'string') {
    setTheme(resolveTheme(remotePayload.theme))
  }

  if (remotePayload.weekState && typeof remotePayload.weekState === 'object' && typeof remotePayload.weekState.weekId === 'string') {
    localStorage.setItem(getWeekStorageKey(remotePayload.weekState.weekId), JSON.stringify(remotePayload.weekState))
  }

  if (remotePayload.history && typeof remotePayload.history === 'object') {
    saveHistory(remotePayload.history)
  }

  if (Array.isArray(remotePayload.recurringTemplates)) {
    setRecurringTemplates(remotePayload.recurringTemplates)
    saveRecurringTemplates(remotePayload.recurringTemplates)
  }

  if (Array.isArray(remotePayload.recurringDone) && typeof remotePayload.dateId === 'string') {
    localStorage.setItem(getRecurringDoneStorageKey(remotePayload.dateId), JSON.stringify(remotePayload.recurringDone))
  }

  if (remotePayload.dailyQuotes && typeof remotePayload.dailyQuotes === 'object') {
    setDailyQuotes(remotePayload.dailyQuotes)
    saveDailyQuotes(remotePayload.dailyQuotes)
    const todayValue = remotePayload.dailyQuotes[dateId]
    setTodayMotivation(typeof todayValue === 'string' && todayValue.trim().length > 0 ? todayValue : getDailyMotivation(dateId))
  }

  if (remotePayload.carrySettings && typeof remotePayload.carrySettings === 'object') {
    const incoming = normalizeIncomingCarrySettings(remotePayload.carrySettings)
    setCarrySettings(incoming)
    localStorage.setItem(CARRY_SETTINGS_KEY, JSON.stringify(incoming))
  }

  if (Array.isArray(remotePayload.carryBacklog)) {
    setCarryBacklog(remotePayload.carryBacklog)
    localStorage.setItem(CARRY_BACKLOG_KEY, JSON.stringify(remotePayload.carryBacklog))
  }

  if (Array.isArray(remotePayload.carryLog)) {
    setCarryLog(remotePayload.carryLog)
    localStorage.setItem(CARRY_LOG_KEY, JSON.stringify(remotePayload.carryLog))
  }

  const templatesLength = Array.isArray(remotePayload.recurringTemplates)
    ? remotePayload.recurringTemplates.length
    : recurringTemplatesLength

  setState(loadWeekState(weekId))
  setRecurringDone(loadRecurringDone(dateId, templatesLength))
}

export function buildSyncPayload({
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
  return {
    updatedAt: Date.now(),
    theme,
    dateId,
    weekState: state,
    carrySettings,
    carryBacklog,
    carryLog,
    recurringTemplates,
    recurringDone,
    dailyQuotes,
    history: getHistory(),
  }
}

export function persistSyncTimestamp(timestamp) {
  localStorage.setItem(SYNC_TIMESTAMP_KEY, String(timestamp))
}