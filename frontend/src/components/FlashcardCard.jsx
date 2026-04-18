import { useState } from 'react';

function IconEdit() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className="w-3.5 h-3.5"
    >
      <path d="M5.433 13.917l1.262-3.155A4 4 0 017.58 9.42l6.92-6.918a2.121 2.121 0 013 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 01-.65-.65z" />
      <path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0010 3H4.75A2.75 2.75 0 002 5.75v9.5A2.75 2.75 0 004.75 18h9.5A2.75 2.75 0 0017 15.25V10a.75.75 0 00-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5z" />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className="w-3.5 h-3.5"
    >
      <path
        fillRule="evenodd"
        d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export default function FlashcardCard({ card, onUpdate, onDelete }) {
  const isNew = !card.front && !card.back;
  const [isEditing, setIsEditing] = useState(isNew);
  const [front, setFront] = useState(card.front);
  const [back, setBack] = useState(card.back);

  const handleSave = () => {
    if (!front.trim() && !back.trim()) {
      onDelete(card.id);
      return;
    }
    onUpdate(card.id, { front: front.trim(), back: back.trim() });
    setIsEditing(false);
  };

  const handleCancel = () => {
    if (isNew) {
      onDelete(card.id);
      return;
    }
    setFront(card.front);
    setBack(card.back);
    setIsEditing(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSave();
    if (e.key === 'Escape') handleCancel();
  };

  if (isEditing) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-xl p-5 border-2 border-blue-300 dark:border-blue-700 shadow-sm">
        <div className="mb-4">
          <label className="block text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-2">
            Front — Question
          </label>
          <textarea
            autoFocus
            value={front}
            onChange={(e) => setFront(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="What is…?"
            rows={3}
            className="w-full p-3 text-sm text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-400 dark:placeholder-gray-600"
          />
        </div>
        <div className="mb-5">
          <label className="block text-xs font-bold text-green-600 dark:text-green-400 uppercase tracking-widest mb-2">
            Back — Answer
          </label>
          <textarea
            value={back}
            onChange={(e) => setBack(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="The answer is…"
            rows={3}
            className="w-full p-3 text-sm text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent placeholder-gray-400 dark:placeholder-gray-600"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            className="flex-1 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Save
          </button>
          <button
            onClick={handleCancel}
            className="flex-1 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            Cancel
          </button>
        </div>
        <p className="mt-2 text-center text-xs text-gray-400 dark:text-gray-600">
          ⌘ Enter to save · Esc to cancel
        </p>
      </div>
    );
  }

  return (
    <div className="group bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden">
      {/* Front */}
      <div className="px-4 pt-4 pb-3 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-start gap-3">
          <span className="flex-shrink-0 mt-0.5 text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest w-4">
            Q
          </span>
          <p className="flex-1 text-sm text-gray-900 dark:text-gray-100 leading-relaxed">
            {card.front}
          </p>
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 -mt-0.5">
            <button
              onClick={() => setIsEditing(true)}
              title="Edit card"
              className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors"
            >
              <IconEdit />
            </button>
            <button
              onClick={() => onDelete(card.id)}
              title="Delete card"
              className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
            >
              <IconTrash />
            </button>
          </div>
        </div>
      </div>

      {/* Back */}
      <div className="px-4 py-3">
        <div className="flex items-start gap-3">
          <span className="flex-shrink-0 mt-0.5 text-xs font-bold text-green-600 dark:text-green-400 uppercase tracking-widest w-4">
            A
          </span>
          <p className="flex-1 text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
            {card.back}
          </p>
        </div>
        {card.tags && card.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1 pl-7">
            {card.tags.map((tag) => (
              <span
                key={tag}
                className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-500 rounded-full"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
