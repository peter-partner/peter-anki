export default function Header({ darkMode, onToggleDark, onReset, stage, onShowChangelog }) {
  return (
    <header className="sticky top-0 z-50 backdrop-blur-md bg-white/80 dark:bg-gray-950/80 border-b border-gray-200/60 dark:border-gray-800/60">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        <button
          onClick={onReset ?? undefined}
          disabled={!onReset}
          className="flex items-center gap-2.5 disabled:cursor-default enabled:hover:opacity-70 transition-opacity"
        >
          <span className="text-xl">🗂️</span>
          <span className="font-semibold text-gray-900 dark:text-white text-sm tracking-tight">
            PDF to Anki
          </span>
          {stage === 'review' && (
            <span className="hidden sm:inline-block px-2 py-0.5 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full">
              Review
            </span>
          )}
          {stage === 'processing' && (
            <span className="hidden sm:inline-block px-2 py-0.5 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full">
              Processing…
            </span>
          )}
        </button>

        <div className="flex items-center gap-1">
          <button
            onClick={onShowChangelog}
            className="px-2.5 py-1 text-xs font-medium text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            aria-label="What's new"
          >
            v1.3.0
          </button>

          <button
            onClick={onToggleDark}
            className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-base"
            aria-label="Toggle dark mode"
          >
            {darkMode ? '☀️' : '🌙'}
          </button>
        </div>
      </div>
    </header>
  );
}
