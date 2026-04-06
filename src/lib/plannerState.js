export const DAY_NAMES = ['Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba', 'Yakshanba']
export const ROWS_PER_DAY = 7
export const RECURRING_ROWS = 8
export const GOAL_DEFAULT = 70
export const THEME_KEY = 'planner-theme'
export const HISTORY_KEY = 'planner-history-v1'
export const RECURRING_KEY = 'planner-recurring-v1'
export const DAILY_QUOTES_KEY = 'planner-daily-motivation-v1'
export const SYNC_TIMESTAMP_KEY = 'planner-sync-updated-at-v1'
export const TASK_CARRYOVER_KEY_PREFIX = 'planner-carryover-done-'
export const TASK_CARRYOVER_SKIP_KEY_PREFIX = 'planner-carryover-skip-'
export const CARRY_SETTINGS_KEY = 'planner-carry-settings-v1'
export const CARRY_BACKLOG_KEY = 'planner-carry-backlog-v1'
export const CARRY_LOG_KEY = 'planner-carry-log-v1'
export const CARRY_LAST_RUN_DATE_KEY = 'planner-carry-last-run-date-v1'
export const SYNC_PULL_INTERVAL_MS = 60000
export const SYNC_PUSH_DEBOUNCE_MS = 900
export const THEME_OPTIONS = [
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

export function getISOWeekId(date = new Date()) {
  const temp = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = temp.getUTCDay() || 7
  temp.setUTCDate(temp.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(temp.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil((((temp - yearStart) / 86400000) + 1) / 7)
  return `${temp.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`
}

export function getWeekStorageKey(weekId) {
  return `planner-week-${weekId}`
}

export function getDateId(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function getDayIndex(date = new Date()) {
  const day = date.getDay()
  return day === 0 ? 6 : day - 1
}

export function getPreviousDateId(dateId) {
  const [year, month, day] = dateId.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  date.setDate(date.getDate() - 1)
  return getDateId(date)
}

export function parseDateId(dateId) {
  const [year, month, day] = dateId.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function getWeekStart(date = new Date()) {
  const start = new Date(date)
  const dayIndex = getDayIndex(start)
  start.setHours(0, 0, 0, 0)
  start.setDate(start.getDate() - dayIndex)
  return start
}

export function getRecurringDoneStorageKey(dateId) {
  return `planner-recurring-done-${dateId}`
}

export function formatWeekLabel(weekId) {
  const [yearPart, weekPart] = weekId.split('-W')
  return `${yearPart} • ${Number(weekPart)}-hafta`
}

export function formatDayDateLabel(date) {
  return `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}`
}

export function normalizePriority(value) {
  return value === 'high' || value === 'medium' || value === 'low' ? value : 'medium'
}

export function clampGoal(value) {
  const parsed = Number.parseInt(String(value), 10)
  if (Number.isNaN(parsed)) return GOAL_DEFAULT
  return Math.min(100, Math.max(1, parsed))
}

export function getEmptyWeekState(weekId) {
  return {
    weekId,
    goal: GOAL_DEFAULT,
    days: Array.from({ length: 7 }, () =>
      Array.from({ length: ROWS_PER_DAY }, () => ({ text: '', done: false, priority: 'medium', carryDays: 0 })),
    ),
  }
}

export function loadWeekState(weekId) {
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

export function saveWeekState(state) {
  localStorage.setItem(getWeekStorageKey(state.weekId), JSON.stringify(state))
}

export function getHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return typeof parsed === 'object' && parsed ? parsed : {}
  } catch {
    return {}
  }
}

export function saveHistory(history) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history))
}

export function getEmptyRecurringTemplates() {
  return Array.from({ length: RECURRING_ROWS }, () => ({ text: '' }))
}

export function loadRecurringTemplates() {
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

export function saveRecurringTemplates(rows) {
  localStorage.setItem(RECURRING_KEY, JSON.stringify(rows))
}

export function loadRecurringDone(dateId, minRows = RECURRING_ROWS) {
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

export function saveRecurringDone(dateId, doneRows) {
  localStorage.setItem(getRecurringDoneStorageKey(dateId), JSON.stringify(doneRows))
}

export function loadDailyQuotes() {
  try {
    const raw = localStorage.getItem(DAILY_QUOTES_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return typeof parsed === 'object' && parsed ? parsed : {}
  } catch {
    return {}
  }
}

export function saveDailyQuotes(quotes) {
  localStorage.setItem(DAILY_QUOTES_KEY, JSON.stringify(quotes))
}

export function resolveTheme(value) {
  return THEME_OPTIONS.some((theme) => theme.id === value) ? value : 'premium'
}

export function getDailyMotivation(dateId) {
  const seed = dateId.split('-').join('')
  const number = Number.parseInt(seed, 10)
  const safeIndex = Number.isNaN(number) ? 0 : number % MOTIVATION_QUOTES.length
  return MOTIVATION_QUOTES[safeIndex]
}

export function loadCarrySettings() {
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

export function loadCarryBacklog() {
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

export function loadCarryLog() {
  try {
    const raw = localStorage.getItem(CARRY_LOG_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}