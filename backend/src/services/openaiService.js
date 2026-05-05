const OpenAI = require('openai');

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const WORDS_PER_CHUNK = 600;
const WORDS_PER_CARD  = 150; // 1 card per ~150 words of source text
const MAX_CARDS       = 80;
const MIN_PER_CHUNK   = 3;
const MAX_PER_CHUNK   = 6;

function countWords(text) {
  return text.split(/\s+/).filter(Boolean).length;
}

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

function deduplicateCards(cards) {
  const seen = [];

  function normalize(str) {
    return str.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
  }

  function jaccardSimilarity(a, b) {
    const setA = new Set(a.split(' '));
    const setB = new Set(b.split(' '));
    const intersection = [...setA].filter((w) => setB.has(w)).length;
    const union = new Set([...setA, ...setB]).size;
    return union === 0 ? 0 : intersection / union;
  }

  return cards.filter((card) => {
    const norm = normalize(card.front);
    const isDuplicate = seen.some((s) => jaccardSimilarity(norm, s) >= 0.85);
    if (!isDuplicate) seen.push(norm);
    return !isDuplicate;
  });
}

const SYSTEM_PROMPT =
  'You are an Anki flashcard expert. Create clear, atomic flashcards from study material.\n' +
  'Rules: one idea per card, questions answerable in under 10 seconds, no vague stems like "Explain" or "Describe".\n' +
  'Output ONLY a valid JSON array. No markdown, no commentary.';

async function generateCardsForChunk(text, targetCards) {
  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content:
          `Make ${targetCards} Anki flashcards from this text.\n` +
          `Use basic cards for facts and definitions. Use cloze for lists and sequences.\n\n` +
          `Basic: {"type":"basic","front":"Question?","back":"Answer.","tags":["topic"]}\n` +
          `Cloze: {"type":"cloze","front":"The {{c1::term}} does X.","back":"","tags":["topic"]}\n\n` +
          `TEXT:\n${text}\n\n` +
          `Return ONLY: [{"type":"basic"|"cloze","front":"...","back":"...","tags":["..."]}]`,
      },
    ],
    temperature: 0.3,
    max_tokens: 2000,
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

async function generateFlashcardsFromChunks(text, onProgress, _mode = 'visual') {
  const chunks = chunkText(text);
  const totalWords = countWords(text);

  // Budget: 1 card per WORDS_PER_CARD words, capped at MAX_CARDS
  const targetTotal = Math.min(MAX_CARDS, Math.max(MIN_PER_CHUNK, Math.round(totalWords / WORDS_PER_CARD)));

  // Spread budget evenly; each chunk always gets at least MIN_PER_CHUNK cards
  const perChunk = Math.max(MIN_PER_CHUNK, Math.min(MAX_PER_CHUNK, Math.ceil(targetTotal / chunks.length)));

  const allCards = [];
  let lastError = null;

  console.log(`~${totalWords} words, ${chunks.length} chunks, target ${targetTotal} cards (${perChunk}/chunk)`);

  for (let i = 0; i < chunks.length; i++) {
    onProgress(
      (i / chunks.length) * 100,
      `Processing section ${i + 1} of ${chunks.length}…`
    );

    try {
      const cards = await generateCardsForChunk(chunks[i], perChunk);
      allCards.push(
        ...cards
          .map((c, j) => ({
            id: `${Date.now()}-${i}-${j}`,
            type: c.type || 'basic',
            front: (c.front ?? '').trim(),
            back: (c.back ?? '').trim(),
            tags: Array.isArray(c.tags) ? c.tags : [],
          }))
          .filter((c) => c.front)
      );
    } catch (err) {
      lastError = err;
      console.error(`Chunk ${i + 1} failed:`, err.message);

      if (err.status === 401 || err.status === 403) {
        throw new Error('Invalid OpenAI API key. Check your backend/.env file.');
      }
      if (err.status === 429) {
        throw new Error('OpenAI quota exceeded. Add billing credits at platform.openai.com/settings/billing');
      }
    }
  }

  if (allCards.length === 0 && lastError) {
    throw new Error(`OpenAI error: ${lastError.message}`);
  }

  const deduplicated = deduplicateCards(allCards).slice(0, MAX_CARDS);
  console.log(`Cards: ${allCards.length} raw → ${deduplicated.length} after dedup/cap`);

  onProgress(100, 'Done!');
  return { cards: deduplicated, docContext: null };
}

module.exports = { generateFlashcardsFromChunks };
