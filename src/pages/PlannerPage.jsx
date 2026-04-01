import DayCards from '../components/DayCards'
import MonthlyCard from '../components/MonthlyCard'

export default function PlannerPage({
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
