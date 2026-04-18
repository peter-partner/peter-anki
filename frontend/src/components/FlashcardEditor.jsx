import { useState } from 'react';
import FlashcardCard from './FlashcardCard';

function buildAnkiCSV(flashcards, deckName) {
  const header = [
    '#separator:Semicolon',
    '#html:false',
    `#deck:${deckName}`,
    '#notetype:Basic',
    '',
  ].join('\n');

  const rows = flashcards
    .filter((c) => c.front && c.back)
    .map((c) => {
      const front = c.front.replace(/;/g, ',').replace(/\n/g, ' ').trim();
      const back = c.back.replace(/;/g, ',').replace(/\n/g, ' ').trim();
      const tags = (c.tags ?? []).join(' ');
      return tags ? `${front};${back};${tags}` : `${front};${back}`;
    })
    .join('\n');

  return header + rows;
}

function triggerDownload(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function FlashcardEditor({
  flashcards,
  deckName,
  pageCount,
  onUpdateCard,
  onDeleteCard,
  onAddCard,
  onDeckNameChange,
  onReset,
}) {
  const [showImportHelp, setShowImportHelp] = useState(false);

  const validCount = flashcards.filter((c) => c.front && c.back).length;

  const handleExport = () => {
    const csv = buildAnkiCSV(flashcards, deckName);
    const safeName = deckName.replace(/[^a-z0-9_\- ]/gi, '_').trim() || 'flashcards';
    triggerDownload(csv, `${safeName}.csv`, 'text/csv;charset=utf-8');
  };

  return (
    <div className="animate-slide-up">
      {/* ── Toolbar ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="min-w-0">
          <input
            type="text"
            value={deckName}
            onChange={(e) => onDeckNameChange(e.target.value)}
            className="text-2xl font-bold text-gray-900 dark:text-white bg-transparent border-none outline-none focus:ring-0 p-0 w-full truncate"
            placeholder="Deck Name"
          />
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {validCount} flashcard{validCount !== 1 ? 's' : ''}
            {pageCount > 0 && ` · ${pageCount} pages processed`}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
          <button
            onClick={onAddCard}
            className="px-3.5 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            + Add Card
          </button>
          <button
            onClick={handleExport}
            disabled={validCount === 0}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            Export for Anki
          </button>
          <button
            onClick={onReset}
            className="px-3.5 py-2 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-100 transition-colors"
          >
            ← New PDF
          </button>
        </div>
      </div>

      {/* ── Import instructions banner ── */}
      <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50 rounded-xl">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
            📥 How to import into Anki
          </span>
          <button
            onClick={() => setShowImportHelp((v) => !v)}
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
          >
            {showImportHelp ? 'Hide' : 'Show steps'}
          </button>
        </div>

        {showImportHelp && (
          <ol className="mt-3 text-sm text-blue-800 dark:text-blue-300 space-y-1.5 list-decimal list-inside">
            <li>
              Click <strong>Export for Anki</strong> above to download the{' '}
              <code className="font-mono text-xs">.csv</code> file
            </li>
            <li>
              Open <strong>Anki</strong> → <strong>File</strong> →{' '}
              <strong>Import</strong>
            </li>
            <li>
              Select the downloaded{' '}
              <code className="font-mono text-xs">.csv</code> file
            </li>
            <li>
              Confirm <strong>Note Type: Basic</strong> and{' '}
              <strong>Separator: Semicolon</strong>
            </li>
            <li>
              Click <strong>Import</strong> — your deck is ready! 🎉
            </li>
          </ol>
        )}
      </div>

      {/* ── Cards grid ── */}
      {flashcards.length === 0 ? (
        <div className="text-center py-20 text-gray-400 dark:text-gray-600">
          <p className="text-5xl mb-4">📭</p>
          <p className="text-base">No cards yet — add one manually or upload a new PDF.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {flashcards.map((card) => (
            <FlashcardCard
              key={card.id}
              card={card}
              onUpdate={onUpdateCard}
              onDelete={onDeleteCard}
            />
          ))}
        </div>
      )}

      {/* ── Add card dashed button ── */}
      <button
        onClick={onAddCard}
        className="mt-4 w-full py-4 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-xl text-sm text-gray-400 dark:text-gray-600 hover:border-gray-300 dark:hover:border-gray-700 hover:text-gray-500 dark:hover:text-gray-500 transition-all"
      >
        + Add Flashcard
      </button>
    </div>
  );
}
