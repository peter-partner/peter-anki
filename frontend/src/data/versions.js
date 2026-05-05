export const VERSIONS = [
  {
    version: '1.4.0',
    date: 'May 5, 2026',
    label: 'latest',
    changes: [
      'Rebuilt AI pipeline — single direct call per chunk (was 3 calls)',
      'Switched to gpt-4o-mini for all text cards — ~10x cheaper, ~3x faster',
      'Budget-based card count: 1 card per 150 words, capped at 80 total',
      'Removed 30-chunk hard cap — all content processed evenly across document',
      'Dropped pre-summarization and document analysis passes',
      'Lean system prompt replaces 400-token instruction block',
    ],
  },
  {
    version: '1.3.0',
    date: 'Apr 26, 2026',
    changes: [
      'Dual-mode generation: Hybrid Visual and Deep Text',
      'Hybrid Visual mode: text cards + GPT-4o Vision analysis of diagrams and figures',
      'Deep Text mode: maximum card density with aggressive concept decomposition',
      'Comparison, mechanism-chain, and cause-effect card types in Deep Text mode',
      'Mode selector shown on upload screen — switch before uploading',
      'Mode-aware progress messages and density targets',
    ],
  },
  {
    version: '1.2.0',
    date: 'Apr 26, 2026',
    changes: [
      'Scalable card output: small PDFs → 20–40 cards, large PDFs → 80–150 cards',
      'Two-stage AI pipeline per chunk: summarize first, then generate cards',
      'Token-aware card targeting (1 card per ~75 input tokens)',
      'Dynamic per-chunk targets recalculated in real time',
      'Light deduplication pass removes near-identical cards',
      'Smaller chunk size (600 words) for denser, more focused coverage',
    ],
  },
  {
    version: '1.1.0',
    date: 'Apr 22, 2026',
    changes: [
      'Upgraded model from GPT-4o mini → GPT-4o for expert-quality output',
      'Two-phase pipeline: document analysis before card generation',
      'Medical/scientific detection with pathophysiology and pitfall cards',
      'Cloze deletion card type for lists, sequences, and comparisons',
      'Self-validation rules baked into AI prompt',
    ],
  },
  {
    version: '1.0.0',
    date: 'Apr 2026',
    changes: [
      'Initial release',
      'PDF upload with drag-and-drop',
      'AI flashcard generation via GPT-4o mini',
      'Real-time progress via Server-Sent Events',
      'Inline card editing and Anki CSV export',
      'Dark mode',
    ],
  },
];
