type MoodChipsProps = { moods: string[]; disabled: boolean; onPick: (mood: string) => void }

export function MoodChips({ moods, disabled, onPick }: MoodChipsProps) {
  return (
    <ul className="mood-chips" aria-label="Mood ideas">
      {moods.map((mood) => (
        <li key={mood}>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onPick(mood)}
            className="mood-chip"
          >
            {mood}
          </button>
        </li>
      ))}
    </ul>
  )
}
