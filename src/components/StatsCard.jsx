export default function StatsCard({
  metrics,
  achieved,
  goalValue,
  onGoalChange,
  historyEntries,
  weekId,
  dayNames,
}) {
  return (
    <article className="stats-card" aria-live="polite">
      <h2>Statistika</h2>
      <ul className="stats-list">
        <li>
          <span>Kiritilgan vazifalar</span>
          <strong>{metrics.totalActiveTasks}</strong>
        </li>
        <li>
          <span>Bajarilgan vazifalar</span>
          <strong>{metrics.doneTasks}</strong>
        </li>
        <li>
          <span>Yozilgan eslatmalar</span>
          <strong>{metrics.notesCount}</strong>
        </li>
        <li>
          <span>Yuqori ustuvor</span>
          <strong>{metrics.highPriorityCount}</strong>
        </li>
        <li>
          <span>Kunlik doimiy</span>
          <strong>
            {metrics.monthlyDone}/{metrics.monthlyActive}
          </strong>
        </li>
      </ul>

      <div className="goal-row">
        <label htmlFor="goal-input">Haftalik maqsad</label>
        <div className="goal-controls">
          <input
            id="goal-input"
            type="number"
            min="1"
            max="100"
            step="1"
            value={goalValue}
            onChange={(e) => onGoalChange(e.target.value)}
          />
          <span>%</span>
        </div>
        <strong className={`goal-status ${achieved ? 'is-ok' : 'is-warn'}`}>
          {achieved ? 'Maqsad bajarildi' : 'Jarayonda'}
        </strong>
      </div>

      <div className="progress-wrap">
        <div className="progress-meta">
          <span>Bajarilish darajasi</span>
          <strong>{metrics.percent}%</strong>
        </div>
        <div className="progress-track" role="img" aria-label="Bajarilish foizi">
          <span className="progress-fill" style={{ width: `${metrics.percent}%` }} />
        </div>
      </div>

      <div className="chart-wrap">
        <div className="chart-header">
          <h3>Haftalik grafik</h3>
          <span>Maqsad: {goalValue}%</span>
        </div>
        <ul className="chart-grid" aria-label="Kunlar bo'yicha bajarilish grafigi">
          {metrics.perDay.map((item, index) => (
            <li key={dayNames[index]} className="chart-col">
              <div className="chart-bar" style={{ '--target': `${goalValue}%` }}>
                <span className="chart-fill" style={{ height: `${item.percent}%` }} />
              </div>
              <span className="chart-label">{dayNames[index].slice(0, 3)}</span>
              <strong className="chart-value">{item.percent}%</strong>
            </li>
          ))}
        </ul>
      </div>

      <div className="day-stats-wrap">
        <h3>Kunlar bo'yicha</h3>
        <ul className="day-stats-list">
          {metrics.perDay.map((item, index) => (
            <li key={dayNames[index]}>
              <span>{dayNames[index]}</span>
              <strong>
                {item.done}/{item.active} ({item.percent}%)
              </strong>
            </li>
          ))}
        </ul>
      </div>

      <div className="history-wrap">
        <h3>Hafta tarixi</h3>
        <ul className="history-list">
          {historyEntries.length === 0 ? (
            <li className="history-empty">Hozircha tarix yo'q.</li>
          ) : (
            historyEntries.map((item) => (
              <li key={item.weekId} className={item.weekId === weekId ? 'is-current' : ''}>
                <span>{item.weekId}</span>
                <strong>{item.percent}%</strong>
              </li>
            ))
          )}
        </ul>
      </div>
    </article>
  )
}
