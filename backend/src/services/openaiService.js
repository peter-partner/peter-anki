const OpenAI = require('openai');

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const WORDS_PER_CHUNK = 1200; // large enough to capture a full topic section
const MAX_CARDS       = 300;  // exhaustive decks can be large

// ─── Chunking ────────────────────────────────────────────────────────────────

function chunkText(text) {
  const paragraphs = text.split(/\n\n+/);
  const chunks = [];
  let current = '';
  let wordCount = 0;

  for (const para of paragraphs) {
    const words = para.split(/\s+/).length;
    if (wordCount + words > WORDS_PER_CHUNK && current) {
      chunks.push(current.trim());
      current = para;
      wordCount = words;
    } else {
      current = current ? `${current}\n\n${para}` : para;
      wordCount += words;
    }
  }

  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

// ─── Deduplication (Jaccard on question stems) ───────────────────────────────

function deduplicateCards(cards) {
  const seen = [];

  const normalize = (s) =>
    s.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();

  const jaccard = (a, b) => {
    const A = new Set(a.split(' '));
    const B = new Set(b.split(' '));
    const inter = [...A].filter((w) => B.has(w)).length;
    const union = new Set([...A, ...B]).size;
    return union === 0 ? 0 : inter / union;
  };

  return cards.filter((card) => {
    const norm = normalize(card.front);
    const isDup = seen.some((s) => jaccard(norm, s) >= 0.85);
    if (!isDup) seen.push(norm);
    return !isDup;
  });
}

// ─── Prompts ─────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a medical flashcard expert producing high-yield Anki decks.
Your goal is EXHAUSTIVE, ATOMIC coverage — one card per distinct testable fact.

COVERAGE — generate a card for every:
  definition, classification, cause/etiology, sign/symptom, diagnostic criterion,
  management step, drug name and dose, numeric threshold/value, named sign or maneuver,
  risk factor, complication, and prevention strategy present in the text.
Target yield: 8–12 cards per major topic section. Do NOT skip or merge facts.

ATOMICITY — one fact per card:
  - If a topic has causes, signs, AND treatment → three separate cards.
  - Sub-parts (early vs late, mild/moderate/severe) → one card per sub-part.

QUESTION PHRASING — use these stems:
  "What is…"            → definitions, descriptions, mechanisms
  "What are…"           → lists (causes, signs, treatments, risk factors)
  "What is the [x]…"   → specific numeric or clinical values (doses, thresholds)
  "List some…"          → long open-ended enumerations
  Questions must be self-contained and clinically specific without the source text.

ANSWER FORMAT — strictly comma-separated plain text:
  ✓ Correct:  "Tachypnea, tachycardia, arrhythmia, cyanosis, confusion"
  ✗ Wrong:    "1. Tachypnea 2. Tachycardia 3. Arrhythmia"
  ✗ Wrong:    "- Tachypnea\\n- Tachycardia"
  Single-answer cards: plain sentence or value — "PaO2 < 60 mmHg or SaO2 < 90%"
  Categorised lists: inline label — "Mild: A, B, Moderate: C, D, Severe: E"

DO NOT:
  - Add tags (always use empty array [])
  - Create learning-objective or bibliographic reference cards
  - Duplicate or near-duplicate questions (same question phrased differently)

Output ONLY a valid JSON array. No markdown fences, no commentary.`;

const buildUserPrompt = (text) =>
  `Generate Anki flashcards from the text below.

Be EXHAUSTIVE — cover every definition, classification, cause, sign/symptom, management step,
drug dose, numeric threshold, named sign/maneuver, risk factor, complication, and prevention strategy.
Target 8–12 cards per major topic section. Do NOT summarise or skip sections.

Return ONLY this JSON (no other text):
[{"front":"Question?","back":"Answer.","tags":[]}]

TEXT:
${text}`;

// ─── API call ─────────────────────────────────────────────────────────────────

async function generateCardsForChunk(text) {
  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user',   content: buildUserPrompt(text) },
    ],
    temperature: 0.2, // lower = more deterministic, less hallucination
    max_tokens: 4096,
  });

  const raw = (response.choices[0]?.message?.content ?? '').trim();
  const match = raw.match(/\[[\s\S]*\]/);
  if (!match) return [];

  try {
    const cards = JSON.parse(match[0]);
    return Array.isArray(cards) ? cards : [];
  } catch {
    return [];
  }
}

// ─── Main export ──────────────────────────────────────────────────────────────

async function generateFlashcardsFromChunks(text, onProgress, _mode = 'visual') {
  const chunks = chunkText(text);
  const allCards = [];
  let lastError = null;

  console.log(`Chunked into ${chunks.length} sections (exhaustive mode)`);

  for (let i = 0; i < chunks.length; i++) {
    onProgress(
      (i / chunks.length) * 100,
      `Processing section ${i + 1} of ${chunks.length}…`
    );

    try {
      const cards = await generateCardsForChunk(chunks[i]);
      allCards.push(
        ...cards
          .map((c, j) => ({
            id: `${Date.now()}-${i}-${j}`,
            front: (c.front ?? '').trim(),
            back:  (c.back  ?? '').trim(),
            tags:  [],  // always empty per spec
          }))
          .filter((c) => c.front && c.back)
      );
    } catch (err) {
      lastError = err;
      console.error(`Chunk ${i + 1} failed:`, err.message);

      if (err.status === 401 || err.status === 403)
        throw new Error('Invalid OpenAI API key. Check your backend/.env file.');
      if (err.status === 429)
        throw new Error('OpenAI quota exceeded. Add billing credits at platform.openai.com/settings/billing');
    }
  }

  if (allCards.length === 0 && lastError)
    throw new Error(`OpenAI error: ${lastError.message}`);

  const deduplicated = deduplicateCards(allCards).slice(0, MAX_CARDS);
  console.log(`Cards: ${allCards.length} raw → ${deduplicated.length} after dedup`);

  onProgress(100, 'Done!');
  return { cards: deduplicated, docContext: null };
}

module.exports = { generateFlashcardsFromChunks };
