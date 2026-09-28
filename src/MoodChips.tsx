type MoodChipsProps = { moods: string[]; disabled: boolean; onPick: (mood: string) => void }

export function MoodChips({ moods, disabled, onPick }: MoodChipsProps) {
  return (
    <ul className="flex flex-wrap justify-center gap-2" aria-label="Mood ideas">
      {moods.map((mood) => (
        <li key={mood}>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onPick(mood)}
            className="rounded-full border border-neutral-800 px-3 py-1.5 text-sm text-neutral-400 hover:border-neutral-600 hover:text-neutral-200 disabled:opacity-60"
          >
            {mood}
          </button>
        </li>
      ))}
    </ul>
  )
}
