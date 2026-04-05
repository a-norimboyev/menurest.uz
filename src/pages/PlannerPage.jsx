import DayCards from '../components/DayCards'
import MonthlyCard from '../components/MonthlyCard'

export default function PlannerPage({
  dayNames,
  days,
  dateId,
  weekDateLabels,
  editableDayIndex,
  pastDayIndices,
  carryUndo,
  onUndoCarry,
  canRetryCarry,
  onRetryCarry,
  carryLog,
  recurringTasks,
  onTaskChange,
  onRecurringTaskChange,
  normalizePriority,
}) {
  return (
    <section className="planner-grid" aria-label="Haftalik reja">
      {carryUndo ? (
        <article className="notes-card carry-undo-card" aria-live="polite">
          <h2>Auto-ko'chirish bajarildi</h2>
          <p className="monthly-meta">Istasangiz 20 soniya ichida bekor qilishingiz mumkin.</p>
          <button type="button" className="action-btn action-btn-clear" onClick={onUndoCarry}>
            Bekor qilish (Undo)
          </button>
        </article>
      ) : null}

      {canRetryCarry ? (
        <article className="notes-card carry-undo-card" aria-live="polite">
          <h2>Carry bekor qilingan</h2>
          <p className="monthly-meta">Xohlasangiz bugun uchun yana qayta ishga tushirishingiz mumkin.</p>
          <button type="button" className="action-btn" onClick={onRetryCarry}>
            Qayta qo'llash
          </button>
        </article>
      ) : null}

      {carryLog.length > 0 ? (
        <article className="notes-card backlog-card">
          <h2>Hafta o‘tish logi</h2>
          <ul className="history-list">
            {carryLog.slice(0, 6).map((entry, index) => (
              <li key={`${entry.dateId}-${entry.fromWeek}-${entry.toWeek}-${index}`}>
                <span>{entry.dateId}</span>
                <strong>
                  {entry.fromWeek} → {entry.toWeek} ({entry.moved} ta)
                </strong>
              </li>
            ))}
          </ul>
        </article>
      ) : null}

      <DayCards
        dayNames={dayNames}
        days={days}
        weekDateLabels={weekDateLabels}
        editableDayIndex={editableDayIndex}
        pastDayIndices={pastDayIndices}
        onTaskChange={onTaskChange}
        normalizePriority={normalizePriority}
      />
      <MonthlyCard dateId={dateId} tasks={recurringTasks} onTaskChange={onRecurringTaskChange} />
    </section>
  )
}
