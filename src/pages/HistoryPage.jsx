export default function HistoryPage({ historyEntries }) {
  const trendEntries = historyEntries.slice(0, 12).reverse()
  const chartWidth = 100
  const chartHeight = 48
  const points = trendEntries
    .map((item, index) => {
      const x = trendEntries.length <= 1 ? chartWidth / 2 : (index / (trendEntries.length - 1)) * chartWidth
      const y = chartHeight - (item.percent / 100) * chartHeight
      return `${x},${y}`
    })
    .join(' ')

  return (
    <section className="single-grid" aria-label="Hafta tarixi">
      <article className="stats-card history-page-card">
        <h2>To'liq tarix</h2>
        {trendEntries.length > 0 && (
          <div className="trend-wrap" aria-label="Haftalik trend chizig'i">
            <div className="trend-header">
              <h3>Trend Grafik</h3>
              <span>Oxirgi {trendEntries.length} hafta</span>
            </div>
            <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="trend-svg" role="img" aria-label="Bajarilish trendi">
              <line x1="0" y1={chartHeight} x2={chartWidth} y2={chartHeight} className="trend-axis" />
              <polyline points={points} className="trend-line" />
              {trendEntries.map((item, index) => {
                const x = trendEntries.length <= 1 ? chartWidth / 2 : (index / (trendEntries.length - 1)) * chartWidth
                const y = chartHeight - (item.percent / 100) * chartHeight
                return <circle key={item.weekId} cx={x} cy={y} r="1.6" className="trend-dot" />
              })}
            </svg>
            <div className="trend-labels">
              <span>{trendEntries[0].weekId}</span>
              <span>{trendEntries[trendEntries.length - 1].weekId}</span>
            </div>
          </div>
        )}
        <ul className="history-list">
          {historyEntries.length === 0 ? (
            <li className="history-empty">Hozircha tarix yo'q.</li>
          ) : (
            historyEntries.map((item) => (
              <li key={item.weekId}>
                <span>{item.weekId}</span>
                <strong>
                  {item.percent}% • {item.done}/{item.total}
                </strong>
              </li>
            ))
          )}
        </ul>
      </article>
    </section>
  )
}
