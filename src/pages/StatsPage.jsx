import StatsCard from '../components/StatsCard'

export default function StatsPage({ metrics, achieved, goalValue, onGoalChange, historyEntries, weekId, dayNames }) {
  return (
    <section className="single-grid" aria-label="Haftalik statistika">
      <StatsCard
        metrics={metrics}
        achieved={achieved}
        goalValue={goalValue}
        onGoalChange={onGoalChange}
        historyEntries={historyEntries.slice(0, 6)}
        weekId={weekId}
        dayNames={dayNames}
      />
    </section>
  )
}
