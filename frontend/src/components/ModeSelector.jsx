const MODES = [
  {
    id: 'visual',
    icon: '🖼️',
    label: 'Hybrid Visual',
    desc: 'Text cards + AI analysis of diagrams, figures, and tables',
  },
  {
    id: 'text',
    icon: '📚',
    label: 'Deep Text',
    desc: 'Maximum card density — every concept broken down to its core',
  },
];

export default function ModeSelector({ mode, onChange }) {
  return (
    <div className="mb-8">
      <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">
        Generation Mode
      </p>
      <div className="grid grid-cols-2 gap-3">
        {MODES.map((m) => {
          const active = mode === m.id;
          return (
            <button
              key={m.id}
              onClick={() => onChange(m.id)}
              className={`flex flex-col items-start gap-1.5 p-4 rounded-xl border-2 text-left transition-all duration-150 ${
                active
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30'
                  : 'border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 bg-white dark:bg-gray-900'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2">
                  <span className="text-base">{m.icon}</span>
                  <span
                    className={`text-sm font-semibold ${
                      active
                        ? 'text-blue-600 dark:text-blue-400'
                        : 'text-gray-900 dark:text-white'
                    }`}
                  >
                    {m.label}
                  </span>
                </div>
                {active && (
                  <span className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center shrink-0">
                    <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 10 10" fill="none">
                      <path d="M2 5l2.5 2.5L8 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                {m.desc}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
