import { clampGoal, getHistory, normalizePriority, saveHistory } from './plannerState'

export function summarizeWeekState(state) {
  const perDay = state.days.map((rows) => {
    const active = rows.filter((row) => row.text.trim().length > 0).length
    const done = rows.filter((row) => row.text.trim().length > 0 && row.done).length
    const percent = active > 0 ? Math.round((done / active) * 100) : 0
    return { active, done, percent }
  })

  const totalActiveTasks = perDay.reduce((sum, day) => sum + day.active, 0)
  const doneTasks = perDay.reduce((sum, day) => sum + day.done, 0)
  const percent = totalActiveTasks > 0 ? Math.round((doneTasks / totalActiveTasks) * 100) : 0

  return { perDay, totalActiveTasks, doneTasks, percent }
}

export function updateWeeklyHistory(state) {
  const summary = summarizeWeekState(state)
  const history = getHistory()
  history[state.weekId] = {
    weekId: state.weekId,
    percent: summary.percent,
    done: summary.doneTasks,
    total: summary.totalActiveTasks,
    updatedAt: Date.now(),
  }
  saveHistory(history)
}

export function buildPlannerMetrics(state, recurringTasks) {
  const summary = summarizeWeekState(state)
  const goal = clampGoal(state.goal)
  const highPriorityCount = state.days
    .flat()
    .filter((row) => row.text.trim().length > 0 && normalizePriority(row.priority) === 'high').length
  const monthlyActive = recurringTasks.filter((row) => row.text.trim().length > 0).length
  const monthlyDone = recurringTasks.filter((row) => row.text.trim().length > 0 && row.done).length

  return {
    ...summary,
    goal,
    highPriorityCount,
    monthlyActive,
    monthlyDone,
  }
}

export function getSortedHistoryEntries() {
  return Object.values(getHistory()).sort((a, b) => b.weekId.localeCompare(a.weekId))
}