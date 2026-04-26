import { useEffect } from 'react';
import { VERSIONS } from '../data/versions';

export default function ChangelogModal({ onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-800 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
          <div>
            <h2 className="font-semibold text-gray-900 dark:text-white text-sm">
              What's New
            </h2>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
              PDF to Anki — update history
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors text-lg"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Version list */}
        <div className="overflow-y-auto max-h-[60vh] px-6 py-4 space-y-6">
          {VERSIONS.map((v) => (
            <div key={v.version}>
              <div className="flex items-center gap-2 mb-3">
                <span className="font-mono text-xs font-semibold text-gray-900 dark:text-white">
                  v{v.version}
                </span>
                {v.label === 'latest' && (
                  <span className="px-1.5 py-0.5 text-[10px] font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full">
                    latest
                  </span>
                )}
                <span className="text-xs text-gray-400 dark:text-gray-500 ml-auto">
                  {v.date}
                </span>
              </div>
              <ul className="space-y-1.5">
                {v.changes.map((change, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-gray-600 dark:text-gray-400">
                    <span className="mt-1 w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-600 shrink-0" />
                    {change}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
