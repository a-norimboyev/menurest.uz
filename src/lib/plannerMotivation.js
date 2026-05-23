import { getDailyMotivation, getPreviousDateId } from './plannerState'

export function resolveTodayMotivation(dailyQuotes, dateId) {
  const saved = dailyQuotes[dateId]
  return typeof saved === 'string' && saved.trim().length > 0 ? saved : getDailyMotivation(dateId)
}

export function getAllMotivations(dailyQuotes) {
  return Object.entries(dailyQuotes)
    .filter(([_, text]) => typeof text === 'string' && text.trim().length > 0)
    .sort((a, b) => b[0].localeCompare(a[0]))
}

export function filterMotivations(allMotivations, query) {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) return allMotivations.slice(0, 20)
  return allMotivations
    .filter(([day, text]) => day.toLowerCase().includes(normalizedQuery) || text.toLowerCase().includes(normalizedQuery))
    .slice(0, 20)
}

export function countMotivationStreak(dailyQuotes, dateId) {
  let streak = 0
  let pointer = dateId

  while (true) {
    const value = dailyQuotes[pointer]
    if (typeof value === 'string' && value.trim().length > 0) {
      streak += 1
      pointer = getPreviousDateId(pointer)
      continue
    }
    break
  }

  return streak
}