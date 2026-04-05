import { useMemo, useState, useEffect, useRef, useCallback } from 'react'
import { Navigate, NavLink, Route, Routes } from 'react-router-dom'
import Header from './components/Header'
import PlannerPage from './pages/PlannerPage'
import StatsPage from './pages/StatsPage'
import HistoryPage from './pages/HistoryPage'
import MotivationPage from './pages/MotivationPage'
import LoginPage from './pages/LoginPage'
import { isCloudSyncEnabled, loadCloudSnapshot, saveCloudSnapshot } from './lib/cloudSync'

const DAY_NAMES = ['Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba', 'Yakshanba']
const ROWS_PER_DAY = 7
const RECURRING_ROWS = 8
const GOAL_DEFAULT = 70
const THEME_KEY = 'planner-theme'
const HISTORY_KEY = 'planner-history-v1'
const RECURRING_KEY = 'planner-recurring-v1'
const DAILY_QUOTES_KEY = 'planner-daily-motivation-v1'
const SYNC_TIMESTAMP_KEY = 'planner-sync-updated-at-v1'
const AUTH_SESSION_KEY = 'planner-auth-ok-v1'
const TASK_CARRYOVER_KEY_PREFIX = 'planner-carryover-done-'
const TASK_CARRYOVER_SKIP_KEY_PREFIX = 'planner-carryover-skip-'
const CARRY_SETTINGS_KEY = 'planner-carry-settings-v1'
const CARRY_BACKLOG_KEY = 'planner-carry-backlog-v1'
const CARRY_LOG_KEY = 'planner-carry-log-v1'
const CARRY_LAST_RUN_DATE_KEY = 'planner-carry-last-run-date-v1'
const SYNC_PULL_INTERVAL_MS = 60000
const SYNC_PUSH_DEBOUNCE_MS = 900
const AUTH_API_BASE_URL = (import.meta.env.VITE_SYNC_BACKEND_URL || '').replace(/\/+$/, '')
const THEME_OPTIONS = [
  { id: 'premium', label: 'Iliq Premium' },
  { id: 'minimal', label: 'Oq Minimal' },
  { id: 'forest', label: 'Yashil Forest' },
  { id: 'rose', label: 'Soft Rose' },
  { id: 'sky', label: 'Osmon Sky' },
  { id: 'dark', label: '🌙 Dark' },
]
const MOTIVATION_QUOTES = [
  'Kichik qadam ham oldinga qadam.',
  'Bugungi intizom ertangi natijani quradi.',
  'Bajarilgan ish kayfiyatni oshiradi.',
  'Har kun 1 foiz o‘sish katta farq qiladi.',
  'Reja bor joyda ishonch bo‘ladi.',
  'Boshlash mukammal bo‘lishdan muhimroq.',
  'Vaqtni boshqar, maqsad seni boshqarmasin.',
  'Oz-ozdan, lekin to‘xtamasdan.',
  'Bugungi mehnat ertangi yengillik.',
  'Fokus qilgan joying o‘sadi.',
]

function getISOWeekId(date = new Date()) {
  const temp = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = temp.getUTCDay() || 7
  temp.setUTCDate(temp.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(temp.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil((((temp - yearStart) / 86400000) + 1) / 7)
  return `${temp.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`
}

function getWeekStorageKey(weekId) {
  return `planner-week-${weekId}`
}

function getDateId(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function getDayIndex(date = new Date()) {
  const day = date.getDay()
  return day === 0 ? 6 : day - 1
}

function getPreviousDateId(dateId) {
  const [year, month, day] = dateId.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  date.setDate(date.getDate() - 1)
  return getDateId(date)
}

function parseDateId(dateId) {
  const [year, month, day] = dateId.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function getWeekStart(date = new Date()) {
  const start = new Date(date)
  const dayIndex = getDayIndex(start)
  start.setHours(0, 0, 0, 0)
  start.setDate(start.getDate() - dayIndex)
  return start
}

function getRecurringDoneStorageKey(dateId) {
  return `planner-recurring-done-${dateId}`
}

function formatWeekLabel(weekId) {
  const [yearPart, weekPart] = weekId.split('-W')
  return `${yearPart} • ${Number(weekPart)}-hafta`
}

function formatDayDateLabel(date) {
  return `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}`
}

function normalizePriority(value) {
  return value === 'high' || value === 'medium' || value === 'low' ? value : 'medium'
}

function clampGoal(value) {
  const parsed = Number.parseInt(String(value), 10)
  if (Number.isNaN(parsed)) return GOAL_DEFAULT
  return Math.min(100, Math.max(1, parsed))
}

function getEmptyWeekState(weekId) {
  return {
    weekId,
    goal: GOAL_DEFAULT,
    days: Array.from({ length: 7 }, () =>
      Array.from({ length: ROWS_PER_DAY }, () => ({ text: '', done: false, priority: 'medium', carryDays: 0 })),
    ),
  }
}

function loadWeekState(weekId) {
  try {
    const raw = localStorage.getItem(getWeekStorageKey(weekId))
    if (!raw) return getEmptyWeekState(weekId)

    const parsed = JSON.parse(raw)
    const fallback = getEmptyWeekState(weekId)

    return {
      weekId,
      goal: clampGoal(parsed?.goal),
      days: fallback.days.map((dayRows, dayIndex) => {
        const storedRows = Array.isArray(parsed?.days?.[dayIndex]) ? parsed.days[dayIndex] : []
        const rowCount = Math.max(dayRows.length, storedRows.length)
        return Array.from({ length: rowCount }, (_, rowIndex) => {
          const fromStorage = storedRows[rowIndex]
          return {
            text: typeof fromStorage?.text === 'string' ? fromStorage.text : '',
            done: Boolean(fromStorage?.done),
            priority: normalizePriority(fromStorage?.priority),
            carryDays: Number.isFinite(fromStorage?.carryDays) ? Math.max(0, Number(fromStorage.carryDays)) : 0,
          }
        })
      }),
    }
  } catch {
    return getEmptyWeekState(weekId)
  }
}

function saveWeekState(state) {
  localStorage.setItem(getWeekStorageKey(state.weekId), JSON.stringify(state))
}

function getHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return typeof parsed === 'object' && parsed ? parsed : {}
  } catch {
    return {}
  }
}

function saveHistory(history) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history))
}

function getEmptyRecurringTemplates() {
  return Array.from({ length: RECURRING_ROWS }, () => ({ text: '' }))
}

function loadRecurringTemplates() {
  try {
    const raw = localStorage.getItem(RECURRING_KEY)
    if (!raw) return getEmptyRecurringTemplates()
    const parsed = JSON.parse(raw)
    const fallback = getEmptyRecurringTemplates()
    const storedRows = Array.isArray(parsed) ? parsed : []
    const rowCount = Math.max(fallback.length, storedRows.length)
    return Array.from({ length: rowCount }, (_, index) => ({
      text: typeof parsed?.[index]?.text === 'string' ? parsed[index].text : '',
    }))
  } catch {
    return getEmptyRecurringTemplates()
  }
}

function saveRecurringTemplates(rows) {
  localStorage.setItem(RECURRING_KEY, JSON.stringify(rows))
}

function loadRecurringDone(dateId, minRows = RECURRING_ROWS) {
  try {
    const raw = localStorage.getItem(getRecurringDoneStorageKey(dateId))
    if (!raw) return Array.from({ length: minRows }, () => false)
    const parsed = JSON.parse(raw)
    const storedRows = Array.isArray(parsed) ? parsed : []
    const rowCount = Math.max(minRows, storedRows.length)
    return Array.from({ length: rowCount }, (_, index) => Boolean(parsed?.[index]))
  } catch {
    return Array.from({ length: minRows }, () => false)
  }
}

function saveRecurringDone(dateId, doneRows) {
  localStorage.setItem(getRecurringDoneStorageKey(dateId), JSON.stringify(doneRows))
}

function loadDailyQuotes() {
  try {
    const raw = localStorage.getItem(DAILY_QUOTES_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return typeof parsed === 'object' && parsed ? parsed : {}
  } catch {
    return {}
  }
}

function saveDailyQuotes(quotes) {
  localStorage.setItem(DAILY_QUOTES_KEY, JSON.stringify(quotes))
}

function resolveTheme(value) {
  return THEME_OPTIONS.some((theme) => theme.id === value) ? value : 'premium'
}

function getDailyMotivation(dateId) {
  const seed = dateId.split('-').join('')
  const number = Number.parseInt(seed, 10)
  const safeIndex = Number.isNaN(number) ? 0 : number % MOTIVATION_QUOTES.length
  return MOTIVATION_QUOTES[safeIndex]
}

function loadCarrySettings() {
  try {
    const raw = localStorage.getItem(CARRY_SETTINGS_KEY)
    if (!raw) return { enabled: true, limit: 3 }
    const parsed = JSON.parse(raw)
    return {
      enabled: parsed?.enabled !== false,
      limit: Math.min(10, Math.max(1, Number.parseInt(String(parsed?.limit ?? 3), 10) || 3)),
    }
  } catch {
    return { enabled: true, limit: 3 }
  }
}

function loadCarryBacklog() {
  try {
    const raw = localStorage.getItem(CARRY_BACKLOG_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((item) => typeof item?.text === 'string' && item.text.trim().length > 0)
      .map((item) => ({
        text: item.text.trim(),
        priority: normalizePriority(item.priority),
        carryDays: Number.isFinite(item?.carryDays) ? Math.max(1, Number(item.carryDays)) : 1,
        fromDate: typeof item?.fromDate === 'string' ? item.fromDate : '',
      }))
  } catch {
    return []
  }
}

function loadCarryLog() {
  try {
    const raw = localStorage.getItem(CARRY_LOG_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => sessionStorage.getItem(AUTH_SESSION_KEY) === '1')
  const [loginUsername, setLoginUsername] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const cloudSyncEnabled = isCloudSyncEnabled()
  const syncReadyRef = useRef(!cloudSyncEnabled)
  const syncTimerRef = useRef(null)
  const skipNextPushRef = useRef(false)
  const lastSyncedTimestampRef = useRef(Number(localStorage.getItem(SYNC_TIMESTAMP_KEY) || 0))
  const [theme, setTheme] = useState(resolveTheme(localStorage.getItem(THEME_KEY)))
  const [currentWeekDate, setCurrentWeekDate] = useState(new Date())
  const [currentDate, setCurrentDate] = useState(() => new Date())
  const weekId = useMemo(() => getISOWeekId(currentWeekDate), [currentWeekDate])
  const dateId = useMemo(() => getDateId(currentDate), [currentDate])
  const todayDate = useMemo(() => parseDateId(dateId), [dateId])
  const todayWeekId = useMemo(() => getISOWeekId(todayDate), [todayDate])
  const todayDayIndex = useMemo(() => getDayIndex(todayDate), [todayDate])
  const weekDateLabels = useMemo(() => {
    const weekStart = getWeekStart(currentWeekDate)
    return DAY_NAMES.map((_, index) => {
      const nextDate = new Date(weekStart)
      nextDate.setDate(weekStart.getDate() + index)
      return formatDayDateLabel(nextDate)
    })
  }, [currentWeekDate])
  const pastDayIndices = useMemo(() => {
    const viewedWeekStart = getWeekStart(currentWeekDate).getTime()
    const currentWeekStart = getWeekStart(todayDate).getTime()

    if (viewedWeekStart < currentWeekStart) {
      return DAY_NAMES.map((_, index) => index)
    }

    if (viewedWeekStart > currentWeekStart) {
      return []
    }

    return DAY_NAMES.map((_, index) => index).filter((index) => index < todayDayIndex)
  }, [currentWeekDate, todayDate, todayDayIndex])
  const [state, setState] = useState(() => loadWeekState(weekId))
  const [recurringTemplates, setRecurringTemplates] = useState(() => loadRecurringTemplates())
  const [recurringDone, setRecurringDone] = useState(() => loadRecurringDone(dateId, recurringTemplates.length))
  const [dailyQuotes, setDailyQuotes] = useState(() => loadDailyQuotes())
  const [motivationQuery, setMotivationQuery] = useState('')
  const [isOnline, setIsOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine))
  const [todayMotivation, setTodayMotivation] = useState(() => {
    const saved = dailyQuotes[dateId]
    return typeof saved === 'string' && saved.trim().length > 0 ? saved : getDailyMotivation(dateId)
  })
  const [carrySettings, setCarrySettings] = useState(() => loadCarrySettings())
  const [carryBacklog, setCarryBacklog] = useState(() => loadCarryBacklog())
  const [carryLog, setCarryLog] = useState(() => loadCarryLog())
  const [carryUndo, setCarryUndo] = useState(null)
  const [carryRefreshToken, setCarryRefreshToken] = useState(0)

  async function verifyCredentials(username, password) {
    if (!AUTH_API_BASE_URL) return false

    try {
      const response = await fetch(`${AUTH_API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      })
      if (!response.ok) return false
      const data = await response.json()
      return Boolean(data?.ok)
    } catch {
      return false
    }
  }

  async function handleLoginSubmit(event) {
    event.preventDefault()

    const isValid = await verifyCredentials(loginUsername.trim(), loginPassword)
    if (isValid) {
      sessionStorage.setItem(AUTH_SESSION_KEY, '1')
      setIsAuthenticated(true)
      setLoginError('')
      setLoginPassword('')
      return
    }

    setLoginError('Login yoki parol noto‘g‘ri (yoki backend ulanmagan).')
  }

  const recurringTasks = useMemo(
    () => recurringTemplates.map((row, index) => ({ text: row.text, done: Boolean(recurringDone[index]) })),
    [recurringTemplates, recurringDone],
  )
  const allMotivations = useMemo(() => {
    return Object.entries(dailyQuotes)
      .filter(([_, text]) => typeof text === 'string' && text.trim().length > 0)
      .sort((a, b) => b[0].localeCompare(a[0]))
  }, [dailyQuotes])

  const filteredMotivations = useMemo(() => {
    const q = motivationQuery.trim().toLowerCase()
    if (!q) return allMotivations.slice(0, 20)
    return allMotivations
      .filter(([day, text]) => day.toLowerCase().includes(q) || text.toLowerCase().includes(q))
      .slice(0, 20)
  }, [allMotivations, motivationQuery])

  const motivationStreak = useMemo(() => {
    let streak = 0
    let pointer = dateId
    while (true) {
      const value = dailyQuotes[pointer]
      if (typeof value === 'string' && value.trim().length > 0) {
        streak += 1
        pointer = getPreviousDateId(pointer)
      } else {
        break
      }
    }
    return streak
  }, [dailyQuotes, dateId])

  useEffect(() => {
    document.body.dataset.theme = resolveTheme(theme)
    localStorage.setItem(THEME_KEY, theme)
  }, [theme])

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      const now = new Date()
      if (getDateId(now) !== getDateId(currentDate)) {
        setCurrentDate(now)
      }
    }, 60000)

    return () => window.clearInterval(intervalId)
  }, [currentDate])

  useEffect(() => {
    localStorage.setItem(CARRY_SETTINGS_KEY, JSON.stringify(carrySettings))
  }, [carrySettings])

  useEffect(() => {
    localStorage.setItem(CARRY_BACKLOG_KEY, JSON.stringify(carryBacklog))
  }, [carryBacklog])

  useEffect(() => {
    localStorage.setItem(CARRY_LOG_KEY, JSON.stringify(carryLog.slice(0, 30)))
  }, [carryLog])

  useEffect(() => {
    if (!carryUndo) return
    const timer = window.setTimeout(() => setCarryUndo(null), 20000)
    return () => window.clearTimeout(timer)
  }, [carryUndo])

  useEffect(() => {
    const todayDate = parseDateId(dateId)
    const lastRunRaw = localStorage.getItem(CARRY_LAST_RUN_DATE_KEY)
    let runDate = lastRunRaw ? parseDateId(lastRunRaw) : parseDateId(dateId)
    runDate.setHours(0, 0, 0, 0)
    todayDate.setHours(0, 0, 0, 0)

    if (lastRunRaw) {
      runDate.setDate(runDate.getDate() + 1)
    }

    let backlogDraft = [...carryBacklog]
    let changedAny = false
    let undoPayload = null
    const newLogs = []

    while (runDate.getTime() <= todayDate.getTime()) {
      const targetDateId = getDateId(runDate)
      const carryKey = `${TASK_CARRYOVER_KEY_PREFIX}${targetDateId}`
      const skipKey = `${TASK_CARRYOVER_SKIP_KEY_PREFIX}${targetDateId}`

      if (localStorage.getItem(carryKey) === '1' || localStorage.getItem(skipKey) === '1') {
        localStorage.setItem(CARRY_LAST_RUN_DATE_KEY, targetDateId)
        runDate.setDate(runDate.getDate() + 1)
        continue
      }

      const previousDate = new Date(runDate)
      previousDate.setDate(previousDate.getDate() - 1)

      const currentWeek = getISOWeekId(runDate)
      const previousWeek = getISOWeekId(previousDate)
      const currentDayIndex = getDayIndex(runDate)
      const previousDayIndex = getDayIndex(previousDate)

      const sourceWeek = loadWeekState(previousWeek)
      const targetWeek = previousWeek === currentWeek ? sourceWeek : loadWeekState(currentWeek)

      const sourceWeekBefore = structuredClone(sourceWeek)
      const targetWeekBefore = structuredClone(targetWeek)
      const backlogBefore = structuredClone(backlogDraft)

      const sourceRows = sourceWeek.days[previousDayIndex]
      const undone = sourceRows
        .filter((row) => row.text.trim().length > 0 && !row.done)
        .map((row) => ({
          text: row.text.trim(),
          done: false,
          priority: normalizePriority(row.priority),
          carryDays: Number.isFinite(row?.carryDays) ? Math.max(0, Number(row.carryDays)) : 0,
        }))

      // Legacy backlog entries are also injected automatically so no task is hidden.
      if (targetDateId === dateId && backlogDraft.length > 0) {
        undone.push(
          ...backlogDraft.map((item) => ({
            text: item.text,
            done: false,
            priority: normalizePriority(item.priority),
            carryDays: Number.isFinite(item?.carryDays) ? Math.max(1, Number(item.carryDays)) : 1,
          })),
        )
        backlogDraft = []
      }

      if (undone.length === 0) {
        localStorage.setItem(carryKey, '1')
        localStorage.setItem(CARRY_LAST_RUN_DATE_KEY, targetDateId)
        runDate.setDate(runDate.getDate() + 1)
        continue
      }

      sourceWeek.days[previousDayIndex] = sourceRows.map((row) => {
        if (row.text.trim().length > 0 && !row.done) {
          return { text: '', done: false, priority: 'medium', carryDays: 0 }
        }
        return row
      })

      const nextTargetRows = [...targetWeek.days[currentDayIndex]]
      const existingToday = new Set(
        nextTargetRows
          .filter((row) => row.text.trim().length > 0)
          .map((row) => `${row.text.trim().toLowerCase()}|${normalizePriority(row.priority)}`),
      )

      const uniqueUndone = []
      undone.forEach((task) => {
        const nextCarryDays = task.carryDays + 1
        const nextPriority = nextCarryDays >= 3 ? 'high' : task.priority
        const taskKey = `${task.text.toLowerCase()}|${nextPriority}`
        if (existingToday.has(taskKey)) {
          return
        }
        uniqueUndone.push({ ...task, carryDays: nextCarryDays, priority: nextPriority })
        existingToday.add(taskKey)
      })

      const toToday = uniqueUndone

      toToday.forEach((task) => {
        const emptyIndex = nextTargetRows.findIndex((row) => row.text.trim().length === 0)
        if (emptyIndex >= 0) {
          nextTargetRows[emptyIndex] = task
        } else {
          nextTargetRows.push(task)
        }
      })

      targetWeek.days[currentDayIndex] = nextTargetRows
      saveWeekState(sourceWeek)
      if (previousWeek !== currentWeek) {
        saveWeekState(targetWeek)
      }

      if (previousWeek !== currentWeek && toToday.length > 0) {
        newLogs.push({
          dateId: targetDateId,
          fromWeek: previousWeek,
          toWeek: currentWeek,
          moved: toToday.length,
        })
      }

      if (targetDateId === dateId) {
        undoPayload = {
          dateId: targetDateId,
          sourceWeekId: previousWeek,
          targetWeekId: currentWeek,
          sourceWeekBefore,
          targetWeekBefore,
          backlogBefore,
        }
      }

      changedAny = true
      localStorage.setItem(carryKey, '1')
      localStorage.setItem(CARRY_LAST_RUN_DATE_KEY, targetDateId)
      runDate.setDate(runDate.getDate() + 1)
    }

    if (!changedAny) return

    setCarryBacklog(backlogDraft)
    if (newLogs.length > 0) {
      setCarryLog((prev) => [...newLogs.reverse(), ...prev].slice(0, 30))
    }
    if (undoPayload) {
      setCarryUndo(undoPayload)
    }

    if (weekId === todayWeekId) {
      setState(loadWeekState(todayWeekId))
    }
  }, [dateId, weekId, todayWeekId, carryBacklog, carryRefreshToken])

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

  const applyRemotePayload = useCallback((remotePayload) => {
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
      const incoming = {
        enabled: remotePayload.carrySettings.enabled !== false,
        limit: Math.min(10, Math.max(1, Number.parseInt(String(remotePayload.carrySettings.limit ?? 3), 10) || 3)),
      }
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
      : recurringTemplates.length

    setState(loadWeekState(weekId))
    setRecurringDone(loadRecurringDone(dateId, templatesLength))
  }, [dateId, recurringTemplates.length, weekId])

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
          localStorage.setItem(SYNC_TIMESTAMP_KEY, String(latestTimestamp))
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
  }, [applyRemotePayload, cloudSyncEnabled, dateId, weekId])

  useEffect(() => {
    setState(loadWeekState(weekId))
  }, [weekId])

  useEffect(() => {
    saveRecurringTemplates(recurringTemplates)
  }, [recurringTemplates])

  useEffect(() => {
    setRecurringDone((prev) => {
      if (prev.length === recurringTemplates.length) return prev
      const next = Array.from({ length: recurringTemplates.length }, (_, index) => Boolean(prev[index]))
      return next
    })
  }, [recurringTemplates])

  useEffect(() => {
    saveRecurringDone(dateId, recurringDone)
  }, [dateId, recurringDone])

  useEffect(() => {
    saveDailyQuotes(dailyQuotes)
  }, [dailyQuotes])

  useEffect(() => {
    saveWeekState(state)

    const perDay = state.days.map((rows) => {
      const active = rows.filter((row) => row.text.trim().length > 0).length
      const done = rows.filter((row) => row.text.trim().length > 0 && row.done).length
      const percent = active > 0 ? Math.round((done / active) * 100) : 0
      return { active, done, percent }
    })

    const totalActiveTasks = perDay.reduce((sum, day) => sum + day.active, 0)
    const doneTasks = perDay.reduce((sum, day) => sum + day.done, 0)
    const percent = totalActiveTasks > 0 ? Math.round((doneTasks / totalActiveTasks) * 100) : 0

    const history = getHistory()
    history[state.weekId] = {
      weekId: state.weekId,
      percent,
      done: doneTasks,
      total: totalActiveTasks,
      updatedAt: Date.now(),
    }
    saveHistory(history)
  }, [state])

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
      const payload = {
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

      saveCloudSnapshot(payload, lastSyncedTimestampRef.current)
        .then((result) => {
          if (result?.status === 'conflict' && result.remote?.payload) {
            skipNextPushRef.current = true
            applyRemotePayload(result.remote.payload)
            const remoteTimestamp = Number(result.remote.timestamp || 0)
            lastSyncedTimestampRef.current = remoteTimestamp
            localStorage.setItem(SYNC_TIMESTAMP_KEY, String(remoteTimestamp))
            return
          }

          lastSyncedTimestampRef.current = payload.updatedAt
          localStorage.setItem(SYNC_TIMESTAMP_KEY, String(payload.updatedAt))
        })
        .catch(() => null)
    }, SYNC_PUSH_DEBOUNCE_MS)

    return () => {
      if (syncTimerRef.current) {
        clearTimeout(syncTimerRef.current)
      }
    }
  }, [applyRemotePayload, cloudSyncEnabled, isOnline, theme, dateId, state, recurringTemplates, recurringDone, dailyQuotes, carrySettings, carryBacklog, carryLog])

  const metrics = useMemo(() => {
    const perDay = state.days.map((rows) => {
      const active = rows.filter((row) => row.text.trim().length > 0).length
      const done = rows.filter((row) => row.text.trim().length > 0 && row.done).length
      const percent = active > 0 ? Math.round((done / active) * 100) : 0
      return { active, done, percent }
    })

    const totalActiveTasks = perDay.reduce((sum, day) => sum + day.active, 0)
    const doneTasks = perDay.reduce((sum, day) => sum + day.done, 0)
    const percent = totalActiveTasks > 0 ? Math.round((doneTasks / totalActiveTasks) * 100) : 0
    const goal = clampGoal(state.goal)
    const highPriorityCount = state.days
      .flat()
      .filter((row) => row.text.trim().length > 0 && normalizePriority(row.priority) === 'high').length
    const monthlyActive = recurringTasks.filter((row) => row.text.trim().length > 0).length
    const monthlyDone = recurringTasks.filter((row) => row.text.trim().length > 0 && row.done).length

    return { perDay, totalActiveTasks, doneTasks, percent, goal, highPriorityCount, monthlyActive, monthlyDone }
  }, [state, recurringTasks])

  const historyEntries = Object.values(getHistory())
    .sort((a, b) => b.weekId.localeCompare(a.weekId))

  const achieved = metrics.percent >= metrics.goal

  function updateTask(dayIndex, rowIndex, patch) {
    if (weekId !== todayWeekId || dayIndex !== todayDayIndex) return

    setState((prev) => {
      const next = structuredClone(prev)
      next.days[dayIndex][rowIndex] = { ...next.days[dayIndex][rowIndex], ...patch }
      return next
    })
  }

  function updateRecurringTask(rowIndex, patch) {
    if (typeof patch.text === 'string') {
      setRecurringTemplates((prev) => {
        const next = structuredClone(prev)
        next[rowIndex] = { ...next[rowIndex], text: patch.text }
        return next
      })
    }

    if (typeof patch.done === 'boolean') {
      setRecurringDone((prev) => {
        const next = [...prev]
        next[rowIndex] = patch.done
        return next
      })
    }
  }

  function undoLastCarry() {
    if (!carryUndo) return

    saveWeekState(carryUndo.sourceWeekBefore)
    if (carryUndo.sourceWeekId !== carryUndo.targetWeekId) {
      saveWeekState(carryUndo.targetWeekBefore)
    }
    setCarryBacklog(carryUndo.backlogBefore)
    localStorage.setItem(`${TASK_CARRYOVER_SKIP_KEY_PREFIX}${carryUndo.dateId}`, '1')
    localStorage.removeItem(`${TASK_CARRYOVER_KEY_PREFIX}${carryUndo.dateId}`)
    setCarryUndo(null)
    setState(loadWeekState(weekId))
  }

  function retryCarryForToday() {
    localStorage.removeItem(`${TASK_CARRYOVER_SKIP_KEY_PREFIX}${dateId}`)
    localStorage.removeItem(`${TASK_CARRYOVER_KEY_PREFIX}${dateId}`)
    setCarryRefreshToken((value) => value + 1)
  }

  function shiftWeek(delta) {
    setCurrentWeekDate((prev) => {
      const next = new Date(prev)
      next.setDate(next.getDate() + delta * 7)
      return next
    })
  }

  function handleMotivationChange(value) {
    setTodayMotivation(value)
    setDailyQuotes((prev) => ({ ...prev, [dateId]: value }))
  }

  function handleMotivationSave(value) {
    const nextValue = typeof value === 'string' ? value : todayMotivation
    setTodayMotivation(nextValue)
    setDailyQuotes((prev) => ({ ...prev, [dateId]: nextValue }))
  }

  function clearAllMotivationData() {
    setDailyQuotes({})
    setTodayMotivation(getDailyMotivation(dateId))
    setMotivationQuery('')
  }

  return isAuthenticated ? (
    <main className="sheet">
      <Header
        theme={theme}
        themeOptions={THEME_OPTIONS}
        onThemeChange={setTheme}
        weekLabel={formatWeekLabel(weekId)}
        onPrevWeek={() => shiftWeek(-1)}
        onNextWeek={() => shiftWeek(1)}
      />

      <nav className="page-tabs" aria-label="Sahifalar">
        <NavLink to="/planner" className={({ isActive }) => (isActive ? 'tab-link is-active' : 'tab-link')}>
          Reja
        </NavLink>
        <NavLink to="/stats" className={({ isActive }) => (isActive ? 'tab-link is-active' : 'tab-link')}>
          Statistika
        </NavLink>
        <NavLink to="/history" className={({ isActive }) => (isActive ? 'tab-link is-active' : 'tab-link')}>
          Tarix
        </NavLink>
        <NavLink to="/motivation" className={({ isActive }) => (isActive ? 'tab-link is-active' : 'tab-link')}>
          Bugun kuni
        </NavLink>
      </nav>

      <Routes>
        <Route
          path="/planner"
          element={
            <PlannerPage
              dayNames={DAY_NAMES}
              days={state.days}
              dateId={dateId}
              weekDateLabels={weekDateLabels}
              editableDayIndex={weekId === todayWeekId ? todayDayIndex : -1}
              pastDayIndices={pastDayIndices}
              carryUndo={carryUndo}
              onUndoCarry={undoLastCarry}
              canRetryCarry={localStorage.getItem(`${TASK_CARRYOVER_SKIP_KEY_PREFIX}${dateId}`) === '1'}
              onRetryCarry={retryCarryForToday}
              carryLog={carryLog}
              recurringTasks={recurringTasks}
              onTaskChange={updateTask}
              onRecurringTaskChange={updateRecurringTask}
              normalizePriority={normalizePriority}
            />
          }
        />
        <Route
          path="/stats"
          element={
            <StatsPage
              metrics={metrics}
              achieved={achieved}
              goalValue={state.goal}
              onGoalChange={(value) => setState((prev) => ({ ...prev, goal: clampGoal(value) }))}
              historyEntries={historyEntries}
              weekId={weekId}
              dayNames={DAY_NAMES}
            />
          }
        />
        <Route path="/history" element={<HistoryPage historyEntries={historyEntries} />} />
        <Route
          path="/motivation"
          element={
            <MotivationPage
              todayMotivation={todayMotivation}
              onMotivationChange={handleMotivationChange}
              onSaveEntry={handleMotivationSave}
              motivationQuery={motivationQuery}
              onMotivationQueryChange={setMotivationQuery}
              motivationStreak={motivationStreak}
              motivationEntries={filteredMotivations}
              dateId={dateId}
              todayDayName={DAY_NAMES[todayDayIndex]}
              onClearAll={clearAllMotivationData}
            />
          }
        />
        <Route path="*" element={<Navigate to="/planner" replace />} />
      </Routes>
    </main>
  ) : (
    <LoginPage
      username={loginUsername}
      password={loginPassword}
      error={loginError}
      onUsernameChange={setLoginUsername}
      onPasswordChange={setLoginPassword}
      onSubmit={handleLoginSubmit}
    />
  )
}
