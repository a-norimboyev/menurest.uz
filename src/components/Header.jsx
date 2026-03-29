export default function Header({
  theme,
  themeOptions,
  onThemeChange,
  weekLabel,
  onPrevWeek,
  onNextWeek,
  canInstallApp,
  onInstallApp,
  syncStatus,
  syncLabel,
  storageLabel,
}) {
  return (
    <header className="title-wrap">
      <h1 className="title">
        <span className="title-main">HAFTALIK</span>
        <span className="title-script">reja</span>
        <span className="title-main">DAFTARI</span>
      </h1>
      <p className="subtitle">Har kuni ozgina intizom, katta natija olib keladi.</p>
      <div className="meta-row" aria-hidden="true">
        <span className="meta-pill">7 kunlik fokus</span>
        <span className="meta-divider" />
        <span className="meta-pill">Shaxsiy reja</span>
      </div>
      <div className={`sync-pill sync-${syncStatus}`} role="status" aria-live="polite">
        {syncLabel}
      </div>
      <div className="storage-pill" aria-live="polite">
        {storageLabel}
      </div>
      <div className="theme-switch" role="group" aria-label="Tema tanlash">
        {themeOptions.map((option) => (
          <button
            key={option.id}
            type="button"
            className={`theme-btn ${theme === option.id ? 'is-active' : ''}`}
            onClick={() => onThemeChange(option.id)}
          >
            {option.label}
          </button>
        ))}
      </div>
      <div className="week-switch" role="group" aria-label="Haftani almashtirish">
        <button type="button" className="week-btn" onClick={onPrevWeek}>
          Oldingi hafta
        </button>
        <strong id="week-label">{weekLabel}</strong>
        <button type="button" className="week-btn" onClick={onNextWeek}>
          Kelasi hafta
        </button>
        {canInstallApp && (
          <button type="button" className="week-btn" onClick={onInstallApp}>
            Ilova o'rnatish
          </button>
        )}
      </div>
    </header>
  )
}
