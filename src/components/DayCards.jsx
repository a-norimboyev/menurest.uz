export default function DayCards({ dayNames, days, editableDayIndex, pastDayIndices, onTaskChange, onAddTaskRow, normalizePriority }) {
  const pastDays = new Set(pastDayIndices || [])

  return (
    <>
      {dayNames.map((dayName, dayIndex) => (
        <article className="day-card" key={dayName}>
          {pastDays.has(dayIndex) ? (
            <span className="day-lock-badge" aria-label="Qulflangan kun" title="Bu kun o‘tib ketgan">
              🔒
            </span>
          ) : null}
          <h2>{dayName.toLowerCase()}</h2>
          <ul>
            {days[dayIndex].map((row, rowIndex) => (
              <li key={`${dayIndex}-${rowIndex}`} className={row.carryDays > 0 ? 'task-item is-carried' : 'task-item'}>
                <label className="task-row">
                  <input
                    type="checkbox"
                    className="check"
                    checked={row.done}
                    disabled={dayIndex !== editableDayIndex}
                    onChange={(e) => onTaskChange(dayIndex, rowIndex, { done: e.target.checked })}
                  />
                  <div className="task-main">
                    <input
                      type="text"
                      className="task-input"
                      value={row.text}
                      readOnly={dayIndex !== editableDayIndex}
                      onChange={(e) => onTaskChange(dayIndex, rowIndex, { text: e.target.value })}
                    />
                    {row.carryDays > 0 && row.text.trim().length > 0 ? (
                      <span className="task-carry-badge" title="Avvalgi kundan ko'chgan vazifa">
                        +{row.carryDays} kun • ko'chgan
                      </span>
                    ) : null}
                  </div>
                  <select
                    className="task-priority"
                    value={row.priority}
                    disabled={dayIndex !== editableDayIndex}
                    onChange={(e) =>
                      onTaskChange(dayIndex, rowIndex, {
                        priority: normalizePriority(e.target.value),
                      })
                    }
                  >
                    <option value="high">Yuqori</option>
                    <option value="medium">O'rta</option>
                    <option value="low">Past</option>
                  </select>
                </label>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="day-add-btn"
            disabled={dayIndex !== editableDayIndex}
            onClick={() => onAddTaskRow(dayIndex)}
          >
            + Vazifa qo'shish
          </button>
        </article>
      ))}
    </>
  )
}
