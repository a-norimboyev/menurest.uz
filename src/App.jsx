import { useMemo, useState, useEffect, useRef, useCallback } from 'react'
import { Navigate, NavLink, Route, Routes } from 'react-router-dom'
import Header from './components/Header'
import DayCards from './components/DayCards'
import MonthlyCard from './components/MonthlyCard'
import StatsCard from './components/StatsCard'
import { isCloudSyncEnabled, loadCloudSnapshot, saveCloudSnapshot } from './lib/cloudSync'

const DAY_NAMES = ['Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba', 'Yakshanba']
const ROWS_PER_DAY = 7
const NOTES_ROWS = 7
const RECURRING_ROWS = 8
const GOAL_DEFAULT = 70
const THEME_KEY = 'planner-theme'
const HISTORY_KEY = 'planner-history-v1'
const RECURRING_KEY = 'planner-recurring-v1'
const DAILY_QUOTES_KEY = 'planner-daily-motivation-v1'
const SYNC_TIMESTAMP_KEY = 'planner-sync-updated-at-v1'
const AUTH_SESSION_KEY = 'planner-auth-ok-v1'
const AUTH_SYNC_USER_KEY = 'planner-auth-user-id-v1'
const SYNC_PULL_INTERVAL_MS = 60000
const SYNC_PUSH_DEBOUNCE_MS = 900
const AUTH_USERNAME = 'Azizjon'
const AUTH_PASSWORD = 'Azizjon1'
const THEME_OPTIONS = [
  { id: 'premium', label: 'Iliq Premium' },
  { id: 'minimal', label: 'Oq Minimal' },
  { id: 'forest', label: 'Yashil Forest' },
  { id: 'rose', label: 'Soft Rose' },
  { id: 'sky', label: 'Osmon Sky' },
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

function getPreviousDateId(dateId) {
  const [year, month, day] = dateId.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  date.setDate(date.getDate() - 1)
  return getDateId(date)
}

function getRecurringDoneStorageKey(dateId) {
  return `planner-recurring-done-${dateId}`
}

function formatWeekLabel(weekId) {
  const [yearPart, weekPart] = weekId.split('-W')
  return `${yearPart} • ${Number(weekPart)}-hafta`
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
      Array.from({ length: ROWS_PER_DAY }, () => ({ text: '', done: false, priority: 'medium' })),
    ),
    notes: Array.from({ length: NOTES_ROWS }, () => ''),
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
          }
        })
      }),
      notes: fallback.notes.map((_, rowIndex) => {
        const fromStorage = parsed?.notes?.[rowIndex]
        return typeof fromStorage === 'string' ? fromStorage : ''
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

function PlannerPage({
  dayNames,
  days,
  dateId,
  recurringTasks,
  onTaskChange,
  onAddTaskRow,
  onRecurringTaskChange,
  onAddRecurringRow,
  normalizePriority,
}) {
  return (
    <section className="planner-grid" aria-label="Haftalik reja">
      <DayCards
        dayNames={dayNames}
        days={days}
        onTaskChange={onTaskChange}
        onAddTaskRow={onAddTaskRow}
        normalizePriority={normalizePriority}
      />
      <MonthlyCard dateId={dateId} tasks={recurringTasks} onTaskChange={onRecurringTaskChange} onAddTaskRow={onAddRecurringRow} />
    </section>
  )
}

function StatsPage({ metrics, achieved, goalValue, onGoalChange, historyEntries, weekId, dayNames }) {
  return (
    <section className="single-grid" aria-label="Haftalik statistika">
      <StatsCard
        metrics={metrics}
        achieved={achieved}
        goalValue={goalValue}
        onGoalChange={onGoalChange}
        historyEntries={historyEntries.slice(0, 6)}
        weekId={weekId}
        dayNames={dayNames}
      />
    </section>
  )
}

function HistoryPage({ historyEntries }) {
  const trendEntries = historyEntries.slice(0, 12).reverse()
  const chartWidth = 100
  const chartHeight = 48
  const points = trendEntries
    .map((item, index) => {
      const x = trendEntries.length <= 1 ? chartWidth / 2 : (index / (trendEntries.length - 1)) * chartWidth
      const y = chartHeight - (item.percent / 100) * chartHeight
      return `${x},${y}`
    })
    .join(' ')

  return (
    <section className="single-grid" aria-label="Hafta tarixi">
      <article className="stats-card history-page-card">
        <h2>To'liq tarix</h2>
        {trendEntries.length > 0 && (
          <div className="trend-wrap" aria-label="Haftalik trend chizig'i">
            <div className="trend-header">
              <h3>Trend Grafik</h3>
              <span>Oxirgi {trendEntries.length} hafta</span>
            </div>
            <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="trend-svg" role="img" aria-label="Bajarilish trendi">
              <line x1="0" y1={chartHeight} x2={chartWidth} y2={chartHeight} className="trend-axis" />
              <polyline points={points} className="trend-line" />
              {trendEntries.map((item, index) => {
                const x = trendEntries.length <= 1 ? chartWidth / 2 : (index / (trendEntries.length - 1)) * chartWidth
                const y = chartHeight - (item.percent / 100) * chartHeight
                return <circle key={item.weekId} cx={x} cy={y} r="1.6" className="trend-dot" />
              })}
            </svg>
            <div className="trend-labels">
              <span>{trendEntries[0].weekId}</span>
              <span>{trendEntries[trendEntries.length - 1].weekId}</span>
            </div>
          </div>
        )}
        <ul className="history-list">
          {historyEntries.length === 0 ? (
            <li className="history-empty">Hozircha tarix yo'q.</li>
          ) : (
            historyEntries.map((item) => (
              <li key={item.weekId}>
                <span>{item.weekId}</span>
                <strong>
                  {item.percent}% • {item.done}/{item.total}
                </strong>
              </li>
            ))
          )}
        </ul>
      </article>
    </section>
  )
}

function MotivationPage({
  todayMotivation,
  onMotivationChange,
  motivationQuery,
  onMotivationQueryChange,
  motivationStreak,
  motivationEntries,
}) {
  return (
    <section id="motivation-section" className="motivation-footer" aria-live="polite">
      <label className="motivation-label" htmlFor="motivation-input">
        Bugungi motivatsion gapni o'zingiz yozing
      </label>
      <input
        id="motivation-input"
        className="motivation-input"
        type="text"
        value={todayMotivation}
        onChange={(e) => onMotivationChange(e.target.value)}
        placeholder="Masalan: Bugun ham bir qadam oldinga"
      />
      <p className="motivation-hint">Yozgan gapingiz sana bo'yicha saqlanadi va yo'qolmaydi.</p>

      <div className="motivation-stats" aria-label="Motivatsiya statistikasi">
        <span>
          Ketma-ket kun: <strong>{motivationStreak}</strong>
        </span>
        <span>
          Jami yozuv: <strong>{motivationEntries.length}</strong>
        </span>
      </div>

      <input
        className="motivation-search"
        type="search"
        value={motivationQuery}
        onChange={(e) => onMotivationQueryChange(e.target.value)}
        placeholder="Tarixdan qidirish..."
        aria-label="Motivatsion gaplardan qidirish"
      />

      <div className="motivation-history">
        <h4>Oldingi kunlar</h4>
        {motivationEntries.length === 0 ? (
          <p className="motivation-empty">Hozircha saqlangan gap yo'q.</p>
        ) : (
          <ul>
            {motivationEntries.map(([day, text]) => (
              <li key={day}>
                <span>{day}</span>
                <strong>{text}</strong>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

function LoginPage({ username, password, error, onUsernameChange, onPasswordChange, onSubmit }) {
  return (
    <main className="sheet login-shell">
      <section className="login-card" aria-label="Kirish">
        <h1>Kirish</h1>
        <p>Faqat ruxsat etilgan login va parol bilan kirish mumkin.</p>
        <form className="login-form" onSubmit={onSubmit}>
          <label htmlFor="login-username">Login</label>
          <input
            id="login-username"
            type="text"
            autoComplete="username"
            value={username}
            onChange={(event) => onUsernameChange(event.target.value)}
            placeholder="Login"
            required
          />

          <label htmlFor="login-password">Parol</label>
          <input
            id="login-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => onPasswordChange(event.target.value)}
            placeholder="Parol"
            required
          />

          {error ? <p className="login-error">{error}</p> : null}

          <button type="submit">Kirish</button>
        </form>
      </section>
    </main>
  )
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
  const weekId = useMemo(() => getISOWeekId(currentWeekDate), [currentWeekDate])
  const dateId = useMemo(() => getDateId(), [])
  const [installPromptEvent, setInstallPromptEvent] = useState(null)
  const [isStandalone, setIsStandalone] = useState(() => {
    if (typeof window === 'undefined') return false
    const standaloneMedia = window.matchMedia?.('(display-mode: standalone)')
    return Boolean(standaloneMedia?.matches || window.navigator.standalone)
  })

  const [state, setState] = useState(() => loadWeekState(weekId))
  const [recurringTemplates, setRecurringTemplates] = useState(() => loadRecurringTemplates())
  const [recurringDone, setRecurringDone] = useState(() => loadRecurringDone(dateId, loadRecurringTemplates().length))
  const [dailyQuotes, setDailyQuotes] = useState(() => loadDailyQuotes())
  const [motivationQuery, setMotivationQuery] = useState('')
  const [syncStatus, setSyncStatus] = useState(cloudSyncEnabled ? 'syncing' : 'local')
  const [syncLabel, setSyncLabel] = useState(cloudSyncEnabled ? 'Cloud ulanmoqda...' : 'Faqat shu qurilmada')
  const [isOnline, setIsOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine))
  const [todayMotivation, setTodayMotivation] = useState(() => {
    const initialQuotes = loadDailyQuotes()
    const saved = initialQuotes[getDateId()]
    return typeof saved === 'string' && saved.trim().length > 0 ? saved : getDailyMotivation(getDateId())
  })

  function handleLoginSubmit(event) {
    event.preventDefault()

    if (loginUsername.trim() === AUTH_USERNAME && loginPassword === AUTH_PASSWORD) {
      sessionStorage.setItem(AUTH_SESSION_KEY, '1')
      sessionStorage.setItem(AUTH_SYNC_USER_KEY, AUTH_USERNAME)
      setIsAuthenticated(true)
      setLoginError('')
      setLoginPassword('')
      return
    }

    setLoginError('Login yoki parol noto‘g‘ri.')
  }

  useEffect(() => {
    if (isAuthenticated) {
      sessionStorage.setItem(AUTH_SYNC_USER_KEY, AUTH_USERNAME)
    }
  }, [isAuthenticated])

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
    if (typeof window === 'undefined') return

    const media = window.matchMedia?.('(display-mode: standalone)')
    const updateDisplayMode = () => {
      setIsStandalone(Boolean(media?.matches || window.navigator.standalone))
    }
    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault()
      setInstallPromptEvent(event)
    }
    const handleInstalled = () => {
      setInstallPromptEvent(null)
      setIsStandalone(true)
    }

    updateDisplayMode()
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleInstalled)
    media?.addEventListener?.('change', updateDisplayMode)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleInstalled)
      media?.removeEventListener?.('change', updateDisplayMode)
    }
  }, [])

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

    setState(loadWeekState(weekId))
    setRecurringDone(loadRecurringDone(dateId, loadRecurringTemplates().length))
  }, [dateId, weekId])

  useEffect(() => {
    let cancelled = false

    async function pullFromCloud() {
      if (!cloudSyncEnabled) {
        setSyncStatus('local')
        setSyncLabel('Faqat shu qurilmada')
        syncReadyRef.current = true
        return
      }

      if (!navigator.onLine) {
        setSyncStatus('error')
        setSyncLabel('Internetsiz: lokal rejim')
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

        setSyncStatus('synced')
        setSyncLabel('Cloud sinxron: tayyor')
      } catch {
        setSyncStatus('error')
        setSyncLabel('Cloud xatosi: internetni tekshiring')
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
    const notesCount = state.notes.filter((note) => note.trim().length > 0).length
    const percent = totalActiveTasks > 0 ? Math.round((doneTasks / totalActiveTasks) * 100) : 0

    const history = getHistory()
    history[state.weekId] = {
      weekId: state.weekId,
      percent,
      done: doneTasks,
      total: totalActiveTasks,
      notes: notesCount,
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

    setSyncStatus('syncing')
    setSyncLabel('Cloudga saqlanmoqda...')

    syncTimerRef.current = setTimeout(() => {
      const payload = {
        updatedAt: Date.now(),
        theme,
        dateId,
        weekState: state,
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
            setSyncStatus('error')
            setSyncLabel('Konflikt topildi: cloud versiya yuklandi')
            return
          }

          lastSyncedTimestampRef.current = payload.updatedAt
          localStorage.setItem(SYNC_TIMESTAMP_KEY, String(payload.updatedAt))
          setSyncStatus('synced')
          setSyncLabel('Cloud sinxron: saqlandi')
        })
        .catch(() => {
          setSyncStatus('error')
          setSyncLabel('Cloudga yozilmadi: keyin yana urinadi')
        })
    }, SYNC_PUSH_DEBOUNCE_MS)

    return () => {
      if (syncTimerRef.current) {
        clearTimeout(syncTimerRef.current)
      }
    }
  }, [applyRemotePayload, cloudSyncEnabled, isOnline, theme, dateId, state, recurringTemplates, recurringDone, dailyQuotes])

  const metrics = useMemo(() => {
    const perDay = state.days.map((rows) => {
      const active = rows.filter((row) => row.text.trim().length > 0).length
      const done = rows.filter((row) => row.text.trim().length > 0 && row.done).length
      const percent = active > 0 ? Math.round((done / active) * 100) : 0
      return { active, done, percent }
    })

    const totalActiveTasks = perDay.reduce((sum, day) => sum + day.active, 0)
    const doneTasks = perDay.reduce((sum, day) => sum + day.done, 0)
    const notesCount = state.notes.filter((note) => note.trim().length > 0).length
    const percent = totalActiveTasks > 0 ? Math.round((doneTasks / totalActiveTasks) * 100) : 0
    const goal = clampGoal(state.goal)
    const highPriorityCount = state.days
      .flat()
      .filter((row) => row.text.trim().length > 0 && normalizePriority(row.priority) === 'high').length
    const monthlyActive = recurringTasks.filter((row) => row.text.trim().length > 0).length
    const monthlyDone = recurringTasks.filter((row) => row.text.trim().length > 0 && row.done).length

    return { perDay, totalActiveTasks, doneTasks, notesCount, percent, goal, highPriorityCount, monthlyActive, monthlyDone }
  }, [state, recurringTasks])

  const historyEntries = Object.values(getHistory())
    .sort((a, b) => b.weekId.localeCompare(a.weekId))

  const achieved = metrics.percent >= metrics.goal

  function updateTask(dayIndex, rowIndex, patch) {
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

  function addTaskRow(dayIndex) {
    setState((prev) => {
      const next = structuredClone(prev)
      next.days[dayIndex].push({ text: '', done: false, priority: 'medium' })
      return next
    })
  }

  function addRecurringRow() {
    setRecurringTemplates((prev) => [...prev, { text: '' }])
    setRecurringDone((prev) => [...prev, false])
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

  async function handleInstallApp() {
    if (!installPromptEvent) return

    installPromptEvent.prompt()
    try {
      await installPromptEvent.userChoice
    } finally {
      setInstallPromptEvent(null)
    }
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
        canInstallApp={Boolean(installPromptEvent) && !isStandalone}
        onInstallApp={handleInstallApp}
        syncStatus={syncStatus}
        syncLabel={syncLabel}
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
          Motivatsiya
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
              recurringTasks={recurringTasks}
              onTaskChange={updateTask}
              onAddTaskRow={addTaskRow}
              onRecurringTaskChange={updateRecurringTask}
              onAddRecurringRow={addRecurringRow}
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
              motivationQuery={motivationQuery}
              onMotivationQueryChange={setMotivationQuery}
              motivationStreak={motivationStreak}
              motivationEntries={filteredMotivations}
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
