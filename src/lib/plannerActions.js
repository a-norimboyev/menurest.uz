import { TASK_CARRYOVER_KEY_PREFIX, TASK_CARRYOVER_SKIP_KEY_PREFIX, loadWeekState, saveWeekState } from './plannerState'

export function applyTaskPatch(prevState, dayIndex, rowIndex, patch) {
  const next = structuredClone(prevState)
  next.days[dayIndex][rowIndex] = { ...next.days[dayIndex][rowIndex], ...patch }
  return next
}

export function applyRecurringTemplatePatch(prevTemplates, rowIndex, text) {
  const next = structuredClone(prevTemplates)
  next[rowIndex] = { ...next[rowIndex], text }
  return next
}

export function applyRecurringDonePatch(prevDone, rowIndex, done) {
  const next = [...prevDone]
  next[rowIndex] = done
  return next
}

export function undoCarryOperation(carryUndo, weekId, setCarryBacklog, setCarryUndo, setState) {
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

export function retryCarryOperation(dateId, setCarryRefreshToken) {
  localStorage.removeItem(`${TASK_CARRYOVER_SKIP_KEY_PREFIX}${dateId}`)
  localStorage.removeItem(`${TASK_CARRYOVER_KEY_PREFIX}${dateId}`)
  setCarryRefreshToken((value) => value + 1)
}

export function shiftWeekDate(prevDate, delta) {
  const next = new Date(prevDate)
  next.setDate(next.getDate() + delta * 7)
  return next
}