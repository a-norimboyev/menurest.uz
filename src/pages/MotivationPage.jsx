import { useEffect, useRef, useState } from 'react'
import { deleteAllMedia, deleteMedia, loadAllMedia, loadMedia, saveMedia } from '../lib/mediaStore'

function buildMotivationAnalysis(text, mediaCount) {
  const cleanText = text.trim()
  const words = cleanText.length > 0 ? cleanText.split(/\s+/).filter(Boolean) : []
  const lower = cleanText.toLowerCase()
  const focusedWords = ['reja', 'vazifa', 'ish', 'dars', 'yakun', 'fokus', 'intizom']
  const positiveWords = ['yaxshi', 'zor', 'ajoyib', 'muhim', 'oldinga', 'osad', 'o\'sad', 'baraka']
  const tiredWords = ['qiyin', 'charcha', 'ulgurolma', 'kech', 'muammo']

  const hasFocusedTone = focusedWords.some((word) => lower.includes(word))
  const hasPositiveTone = positiveWords.some((word) => lower.includes(word))
  const hasTiredTone = tiredWords.some((word) => lower.includes(word))

  let tone = 'neytral'
  if (hasPositiveTone) tone = 'ijobiy'
  if (hasFocusedTone) tone = 'fokusli'
  if (hasTiredTone && !hasPositiveTone) tone = 'bosim yuqori'

  let sizeLabel = 'qisqa'
  if (words.length >= 12) sizeLabel = 'batafsil'
  else if (words.length >= 6) sizeLabel = 'o\'rtacha'

  return `Tahlil: ${sizeLabel} yozuv, ${words.length} ta so'z, ohang ${tone}. Media: ${mediaCount} ta.`
}

export default function MotivationPage({
  todayMotivation,
  onMotivationChange,
  onSaveEntry,
  motivationQuery,
  onMotivationQueryChange,
  motivationStreak,
  motivationEntries,
  dateId,
  todayDayName,
  onClearAll,
}) {
  const [mediaItems, setMediaItems] = useState([])
  const [allMediaMap, setAllMediaMap] = useState({})
  const [mediaUrls, setMediaUrls] = useState({})
  const [historyMediaUrls, setHistoryMediaUrls] = useState({})
  const [uploading, setUploading] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')
  const [analysisMessage, setAnalysisMessage] = useState('')
  const fileInputRef = useRef(null)

  function refreshAllMedia() {
    loadAllMedia().then(setAllMediaMap).catch(() => {})
  }

  useEffect(() => {
    loadMedia(dateId).then(setMediaItems).catch(() => {})
    refreshAllMedia()
  }, [dateId])

  useEffect(() => {
    const nextUrls = {}
    for (const item of mediaItems) {
      nextUrls[item.id] = URL.createObjectURL(item.blob)
    }
    setMediaUrls(nextUrls)

    return () => {
      Object.values(nextUrls).forEach((url) => URL.revokeObjectURL(url))
    }
  }, [mediaItems])

  useEffect(() => {
    const nextUrls = {}
    for (const [day, items] of Object.entries(allMediaMap)) {
      nextUrls[day] = {}
      for (const item of items) {
        nextUrls[day][item.id] = URL.createObjectURL(item.blob)
      }
    }
    setHistoryMediaUrls(nextUrls)

    return () => {
      Object.values(nextUrls).forEach((dayMap) => {
        Object.values(dayMap).forEach((url) => URL.revokeObjectURL(url))
      })
    }
  }, [allMediaMap])

  useEffect(() => {
    setSaveMessage('')
    setAnalysisMessage('')
  }, [todayMotivation, dateId])

  async function handleFileSelect(event) {
    const files = Array.from(event.target.files || [])
    if (files.length === 0) return
    setUploading(true)
    try {
      for (const file of files) {
        await saveMedia(dateId, file)
      }
      const updated = await loadMedia(dateId)
      setMediaItems(updated)
      refreshAllMedia()
    } catch {
      // silent
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleDeleteMedia(id) {
    await deleteMedia(id)
    const updated = await loadMedia(dateId)
    setMediaItems(updated)
    refreshAllMedia()
  }

  async function handleClearAll() {
    const shouldClear = window.confirm("Bugun kuni ichidagi barcha yozuv va media tarixini o'chirasizmi?")
    if (!shouldClear) return

    await deleteAllMedia()
    onClearAll()
    setMediaItems([])
    setAllMediaMap({})
  }

  function handleSave() {
    onSaveEntry(todayMotivation)
    setSaveMessage('Saqlandi')
  }

  function handleAnalyze() {
    setAnalysisMessage(buildMotivationAnalysis(todayMotivation, mediaItems.length))
  }

  return (
    <section id="motivation-section" className="motivation-footer" aria-live="polite">
      <div className="daily-card">
        <div className="motivation-day-header">
          <strong>{todayDayName}</strong>
          <div className="motivation-day-actions">
            <span>{dateId}</span>
            <button type="button" className="action-btn action-btn-clear motivation-clear-btn" onClick={handleClearAll}>
              Tozalash
            </button>
          </div>
        </div>
        <label className="motivation-label" htmlFor="motivation-input">
          Bugun uchun qisqacha yozing
        </label>
        <div className="motivation-input-row">
          <input
            id="motivation-input"
            className="motivation-input"
            type="text"
            value={todayMotivation}
            onChange={(e) => onMotivationChange(e.target.value)}
            placeholder="Masalan: Bugun asosiy vazifa - dars va ishlarni yakunlash"
          />

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            multiple
            onChange={handleFileSelect}
            className="media-file-input"
            id="media-file-input"
          />
          <label htmlFor="media-file-input" className="media-upload-btn">
            {uploading ? '...' : '📷 / 🎬'}
          </label>
        </div>

        <div className="motivation-action-row">
          <button type="button" className="action-btn" onClick={handleSave}>
            Saqlash
          </button>
          <button type="button" className="action-btn" onClick={handleAnalyze}>
            Tahlil
          </button>
          {saveMessage ? <span className="motivation-inline-note">{saveMessage}</span> : null}
        </div>

        {analysisMessage ? <p className="motivation-analysis-box">{analysisMessage}</p> : null}

        {mediaItems.length > 0 && (
          <div className="media-grid">
            {mediaItems.map((item) => (
              <div key={item.id} className="media-item">
                {item.type === 'video' ? (
                  <video src={mediaUrls[item.id]} controls className="media-preview" />
                ) : (
                  <img src={mediaUrls[item.id]} alt={item.name} className="media-preview" />
                )}
                <button
                  type="button"
                  className="media-delete-btn"
                  onClick={() => handleDeleteMedia(item.id)}
                  aria-label={`${item.name} ni o'chirish`}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="motivation-stats" aria-label="Statistika">
        <span>
          Ketma-ket kun: <strong>{motivationStreak}</strong>
        </span>
        <span>
          Jami yozuv: <strong>{motivationEntries.length}</strong>
        </span>
      </div>

      <input
        className="motivation-search"
        type="search"
        value={motivationQuery}
        onChange={(e) => onMotivationQueryChange(e.target.value)}
        placeholder="Tarixdan qidirish..."
        aria-label="Tarixdan qidirish"
      />

      <div className="motivation-history">
        <h4>Oldingi kunlar</h4>
        {motivationEntries.length === 0 ? (
          <p className="motivation-empty">Hozircha saqlangan gap yo'q.</p>
        ) : (
          <ul>
            {motivationEntries.map(([day, text]) => (
              <li key={day} className="history-entry">
                <span>{day}</span>
                <div className="history-entry-content">
                  <strong>{text}</strong>
                  {allMediaMap[day] && allMediaMap[day].length > 0 && (
                    <div className="history-media-row">
                      {allMediaMap[day].map((item) => (
                        item.type === 'video' ? (
                          <video key={item.id} src={historyMediaUrls[day]?.[item.id]} controls className="history-media-thumb" />
                        ) : (
                          <img key={item.id} src={historyMediaUrls[day]?.[item.id]} alt={item.name} className="history-media-thumb" />
                        )
                      ))}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
