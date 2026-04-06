import {
  CARRY_LAST_RUN_DATE_KEY,
  TASK_CARRYOVER_KEY_PREFIX,
  TASK_CARRYOVER_SKIP_KEY_PREFIX,
  getDateId,
  getDayIndex,
  getISOWeekId,
  loadWeekState,
  normalizePriority,
  parseDateId,
  saveWeekState,
} from './plannerState'

export function runCarryover({ dateId, carryBacklog }) {
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

    uniqueUndone.forEach((task) => {
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

    if (previousWeek !== currentWeek && uniqueUndone.length > 0) {
      newLogs.push({
        dateId: targetDateId,
        fromWeek: previousWeek,
        toWeek: currentWeek,
        moved: uniqueUndone.length,
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

  return {
    changedAny,
    backlogDraft,
    newLogs,
    undoPayload,
  }
}