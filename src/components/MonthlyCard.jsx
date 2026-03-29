export default function MonthlyCard({ dateId, tasks, onTaskChange }) {
  return (
    <article className="notes-card monthly-card">
      <h2>Har Kunlik Doimiy Vazifalar</h2>
      <p className="monthly-meta">Bugun: {dateId}</p>
      <ul>
        {tasks.map((task, index) => (
          <li key={index}>
            <label className="task-row monthly-row">
              <input
                type="checkbox"
                className="check"
                checked={task.done}
                onChange={(e) => onTaskChange(index, { done: e.target.checked })}
              />
              <input
                type="text"
                className="task-input"
                value={task.text}
                onChange={(e) => onTaskChange(index, { text: e.target.value })}
              />
              <span className="monthly-badge">Kunlik</span>
            </label>
          </li>
        ))}
      </ul>
    </article>
  )
}
