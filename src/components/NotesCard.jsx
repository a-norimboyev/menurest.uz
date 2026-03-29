export default function NotesCard({ notes, onNoteChange }) {
  return (
    <article className="notes-card">
      <h2>Eslatmalar</h2>
      <ul>
        {notes.map((note, noteIndex) => (
          <li key={noteIndex}>
            <input
              type="text"
              className="note-input"
              value={note}
              onChange={(e) => onNoteChange(noteIndex, e.target.value)}
            />
          </li>
        ))}
      </ul>
    </article>
  )
}
