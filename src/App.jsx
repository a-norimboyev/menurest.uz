import { useMemo, useState, useEffect, useCallback } from 'react'
import { Navigate, NavLink, Route, Routes } from 'react-router-dom'
import Header from './components/Header'
import PlannerPage from './pages/PlannerPage'
import StatsPage from './pages/StatsPage'
import HistoryPage from './pages/HistoryPage'
import MotivationPage from './pages/MotivationPage'
import { isCloudSyncEnabled } from './lib/cloudSync'
import { applyRecurringDonePatch, applyRecurringTemplatePatch, applyTaskPatch, retryCarryOperation, shiftWeekDate, undoCarryOperation } from './lib/plannerActions'
import { runCarryover } from './lib/plannerCarryover'
import { countMotivationStreak, filterMotivations, getAllMotivations, resolveTodayMotivation } from './lib/plannerMotivation'
import { buildPlannerMetrics, getSortedHistoryEntries, updateWeeklyHistory } from './lib/plannerMetrics'
import { applyRemotePayloadToApp } from './lib/plannerSync'
import { usePlannerSync } from './lib/usePlannerSync'
import {
  CARRY_BACKLOG_KEY,
  CARRY_LOG_KEY,
  CARRY_SETTINGS_KEY,
  DAY_NAMES,
  TASK_CARRYOVER_SKIP_KEY_PREFIX,
  THEME_KEY,
  THEME_OPTIONS,
  clampGoal,
  formatDayDateLabel,
  formatWeekLabel,
  getDailyMotivation,
  getDateId,
  getDayIndex,
  getISOWeekId,
  getWeekStart,
  loadCarryBacklog,
  loadCarryLog,
  loadCarrySettings,
  loadDailyQuotes,
  loadRecurringDone,
  loadRecurringTemplates,
  loadWeekState,
  normalizePriority,
  parseDateId,
  resolveTheme,
  saveDailyQuotes,
  saveRecurringDone,
  saveRecurringTemplates,
  saveWeekState,
} from './lib/plannerState'

export default function App() {
  const cloudSyncEnabled = isCloudSyncEnabled()
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
  const [todayMotivation, setTodayMotivation] = useState(() => resolveTodayMotivation(dailyQuotes, dateId))
  const [carrySettings, setCarrySettings] = useState(() => loadCarrySettings())
  const [carryBacklog, setCarryBacklog] = useState(() => loadCarryBacklog())
  const [carryLog, setCarryLog] = useState(() => loadCarryLog())
  const [carryUndo, setCarryUndo] = useState(null)
  const [carryRefreshToken, setCarryRefreshToken] = useState(0)

  const recurringTasks = useMemo(
    () => recurringTemplates.map((row, index) => ({ text: row.text, done: Boolean(recurringDone[index]) })),
    [recurringTemplates, recurringDone],
  )
  const allMotivations = useMemo(() => getAllMotivations(dailyQuotes), [dailyQuotes])

  const filteredMotivations = useMemo(() => filterMotivations(allMotivations, motivationQuery), [allMotivations, motivationQuery])

  const motivationStreak = useMemo(() => countMotivationStreak(dailyQuotes, dateId), [dailyQuotes, dateId])

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
    const { changedAny, backlogDraft, newLogs, undoPayload } = runCarryover({ dateId, carryBacklog })

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

  const applyRemotePayload = useCallback((remotePayload) => {
    applyRemotePayloadToApp({
      remotePayload,
      dateId,
      weekId,
      recurringTemplatesLength: recurringTemplates.length,
      setTheme,
      setRecurringTemplates,
      setDailyQuotes,
      setTodayMotivation,
      setCarrySettings,
      setCarryBacklog,
      setCarryLog,
      setState,
      setRecurringDone,
    })
  }, [dateId, recurringTemplates.length, weekId])

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
    updateWeeklyHistory(state)
  }, [state])

  usePlannerSync({
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
  })

  const metrics = useMemo(() => buildPlannerMetrics(state, recurringTasks), [state, recurringTasks])

  const historyEntries = getSortedHistoryEntries()

  const achieved = metrics.percent >= metrics.goal

  function updateTask(dayIndex, rowIndex, patch) {
    if (weekId !== todayWeekId || dayIndex !== todayDayIndex) return

    setState((prev) => applyTaskPatch(prev, dayIndex, rowIndex, patch))
  }

  function updateRecurringTask(rowIndex, patch) {
    if (typeof patch.text === 'string') {
      setRecurringTemplates((prev) => applyRecurringTemplatePatch(prev, rowIndex, patch.text))
    }

    if (typeof patch.done === 'boolean') {
      setRecurringDone((prev) => applyRecurringDonePatch(prev, rowIndex, patch.done))
    }
  }

  function undoLastCarry() {
    undoCarryOperation(carryUndo, weekId, setCarryBacklog, setCarryUndo, setState)
  }

  function retryCarryForToday() {
    retryCarryOperation(dateId, setCarryRefreshToken)
  }

  function shiftWeek(delta) {
    setCurrentWeekDate((prev) => shiftWeekDate(prev, delta))
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

  return (
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
  )
}
