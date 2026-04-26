import { useState, useCallback, useRef } from 'react';
import Header from './components/Header';
import DropZone from './components/DropZone';
import FlashcardEditor from './components/FlashcardEditor';
import ChangelogModal from './components/ChangelogModal';
import ModeSelector from './components/ModeSelector';

const STAGE = { IDLE: 'idle', PROCESSING: 'processing', REVIEW: 'review' };

export default function App() {
  const [darkMode, setDarkMode] = useState(false);
  const [showChangelog, setShowChangelog] = useState(false);
  const [mode, setMode] = useState('visual');
  const [stage, setStage] = useState(STAGE.IDLE);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [flashcards, setFlashcards] = useState([]);
  const [deckName, setDeckName] = useState('My Deck');
  const [pageCount, setPageCount] = useState(0);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);

  const toggleDarkMode = useCallback(() => {
    setDarkMode((prev) => {
      document.documentElement.classList.toggle('dark', !prev);
      return !prev;
    });
  }, []);

  const handleFileUpload = useCallback(async (file) => {
    setError(null);
    setStage(STAGE.PROCESSING);
    setProgress(0);
    setStatusMessage('Uploading PDF…');

    const formData = new FormData();
    formData.append('pdf', file);
    formData.append('deckName', file.name.replace(/\.pdf$/i, ''));
    formData.append('mode', mode);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL ?? ''}/api/process`, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status} ${response.statusText}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() ?? '';

        for (const block of events) {
          let eventType = '';
          let eventData = '';
          for (const line of block.split('\n')) {
            if (line.startsWith('event: ')) eventType = line.slice(7).trim();
            else if (line.startsWith('data: ')) eventData = line.slice(6);
          }
          if (!eventType || !eventData) continue;

          try {
            const data = JSON.parse(eventData);
            if (eventType === 'status') {
              setProgress(data.progress ?? 0);
              setStatusMessage(data.message ?? '');
            } else if (eventType === 'complete') {
              setFlashcards(data.flashcards ?? []);
              setDeckName(data.deckName ?? 'My Deck');
              setPageCount(data.pageCount ?? 0);
              setStage(STAGE.REVIEW);
            } else if (eventType === 'error') {
              setError(data.message ?? 'An error occurred');
              setStage(STAGE.IDLE);
            }
          } catch {}
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError(err.message || 'Failed to process PDF');
        setStage(STAGE.IDLE);
      }
    }
  }, []);

  const handleCancel = useCallback(() => {
    abortRef.current?.abort();
    setStage(STAGE.IDLE);
    setProgress(0);
    setStatusMessage('');
  }, []);

  const handleReset = useCallback(() => {
    setStage(STAGE.IDLE);
    setFlashcards([]);
    setError(null);
    setProgress(0);
  }, []);

  const updateFlashcard = useCallback(
    (id, updates) =>
      setFlashcards((prev) => prev.map((c) => (c.id === id ? { ...c, ...updates } : c))),
    []
  );

  const deleteFlashcard = useCallback(
    (id) => setFlashcards((prev) => prev.filter((c) => c.id !== id)),
    []
  );

  const addFlashcard = useCallback(() => {
    setFlashcards((prev) => [
      ...prev,
      { id: `new-${Date.now()}`, front: '', back: '', tags: [] },
    ]);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors duration-200">
      <Header
        darkMode={darkMode}
        onToggleDark={toggleDarkMode}
        onReset={stage !== STAGE.IDLE ? handleReset : null}
        stage={stage}
        onShowChangelog={() => setShowChangelog(true)}
      />

      {showChangelog && <ChangelogModal onClose={() => setShowChangelog(false)} />}

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-12">
        {/* ── IDLE ── */}
        {stage === STAGE.IDLE && (
          <div className="animate-fade-in">
            <div className="text-center mb-12">
              <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 dark:text-white mb-4 tracking-tight">
                PDF to Anki
              </h1>
              <p className="text-lg text-gray-500 dark:text-gray-400 max-w-lg mx-auto leading-relaxed">
                Drop a PDF and get AI-generated flashcards in seconds. Built for
                medical students and anyone who loves spaced repetition.
              </p>
            </div>

            <ModeSelector mode={mode} onChange={setMode} />
            <DropZone onFileSelect={handleFileUpload} />

            {error && (
              <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-400 text-sm">
                <strong>Error:</strong> {error}
              </div>
            )}

            <div className="mt-14 grid grid-cols-1 sm:grid-cols-3 gap-5">
              {[
                {
                  icon: '📄',
                  title: 'Upload PDF',
                  desc: 'Lecture slides, textbook chapters, or any study material',
                },
                {
                  icon: '🤖',
                  title: 'AI Processing',
                  desc: 'GPT-4o mini extracts key concepts and builds Q&A pairs',
                },
                {
                  icon: '🎯',
                  title: 'Anki Export',
                  desc: 'Download a CSV and import directly into Anki in one click',
                },
              ].map(({ icon, title, desc }) => (
                <div
                  key={title}
                  className="text-center p-6 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800"
                >
                  <div className="text-3xl mb-3">{icon}</div>
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                    {title}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                    {desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── PROCESSING ── */}
        {stage === STAGE.PROCESSING && (
          <div className="animate-fade-in flex flex-col items-center justify-center py-28 gap-8">
            <div className="relative w-20 h-20">
              <div className="absolute inset-0 rounded-full border-4 border-gray-200 dark:border-gray-800" />
              <div className="absolute inset-0 rounded-full border-4 border-blue-500 border-t-transparent animate-spin" />
            </div>

            <div className="text-center max-w-sm">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
                Generating Flashcards
              </h2>
              <p className="text-gray-500 dark:text-gray-400 text-sm mb-6 min-h-[1.25rem]">
                {statusMessage}
              </p>

              <div className="w-72 bg-gray-200 dark:bg-gray-800 rounded-full h-2 overflow-hidden mx-auto mb-2">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all duration-700 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-gray-400 dark:text-gray-600">
                {Math.round(progress)}%
              </p>
            </div>

            <button
              onClick={handleCancel}
              className="mt-2 px-5 py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 border border-gray-200 dark:border-gray-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        )}

        {/* ── REVIEW ── */}
        {stage === STAGE.REVIEW && (
          <FlashcardEditor
            flashcards={flashcards}
            deckName={deckName}
            pageCount={pageCount}
            onUpdateCard={updateFlashcard}
            onDeleteCard={deleteFlashcard}
            onAddCard={addFlashcard}
            onDeckNameChange={setDeckName}
            onReset={handleReset}
          />
        )}
      </main>
    </div>
  );
}
