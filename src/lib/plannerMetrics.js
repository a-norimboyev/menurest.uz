import { clampGoal, getHistory, normalizePriority, saveHistory } from './plannerState'

export function summarizeWeekState(state) {
  const perDay = state.days.map((rows) => {
    const active = rows.filter((row) => row.text.trim().length > 0).length
    const done = rows.filter((row) => row.text.trim().length > 0 && row.done).length
    const overdueTasks = rows.filter((row) => row.text.trim().length > 0 && !row.done && Number(row.carryDays || 0) > 0).length
    const adjustedActive = active + overdueTasks
    const percent = adjustedActive > 0 ? Math.round((done / adjustedActive) * 100) : 0
    return { active, done, overdueTasks, adjustedActive, percent }
  })

  const totalActiveTasks = perDay.reduce((sum, day) => sum + day.active, 0)
  const doneTasks = perDay.reduce((sum, day) => sum + day.done, 0)
  const overdueTasks = perDay.reduce((sum, day) => sum + day.overdueTasks, 0)
  const adjustedTotalTasks = totalActiveTasks + overdueTasks
  const percent = adjustedTotalTasks > 0 ? Math.round((doneTasks / adjustedTotalTasks) * 100) : 0

  return { perDay, totalActiveTasks, doneTasks, overdueTasks, adjustedTotalTasks, percent }
}

export function updateWeeklyHistory(state) {
  const summary = summarizeWeekState(state)
  const history = getHistory()
  history[state.weekId] = {
    weekId: state.weekId,
    percent: summary.percent,
    done: summary.doneTasks,
    total: summary.adjustedTotalTasks,
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