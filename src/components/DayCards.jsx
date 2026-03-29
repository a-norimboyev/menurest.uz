export default function DayCards({ dayNames, days, onTaskChange, normalizePriority }) {
  return (
    <>
      {dayNames.map((dayName, dayIndex) => (
        <article className="day-card" key={dayName}>
          <h2>{dayName.toLowerCase()}</h2>
          <ul>
            {days[dayIndex].map((row, rowIndex) => (
              <li key={`${dayIndex}-${rowIndex}`}>
                <label className="task-row">
                  <input
                    type="checkbox"
                    className="check"
                    checked={row.done}
                    onChange={(e) => onTaskChange(dayIndex, rowIndex, { done: e.target.checked })}
                  />
                  <input
                    type="text"
                    className="task-input"
                    value={row.text}
                    onChange={(e) => onTaskChange(dayIndex, rowIndex, { text: e.target.value })}
                  />
                  <select
                    className="task-priority"
                    value={row.priority}
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
        </article>
      ))}
    </>
  )
}
