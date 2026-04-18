const OpenAI = require('openai');

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const WORDS_PER_CHUNK = 1500;
const MAX_CHUNKS = 15;

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
  return chunks.slice(0, MAX_CHUNKS);
}

async function generateFlashcardsForChunk(text) {
  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `You are an expert educator creating high-yield Anki flashcards for medical and science students.
Focus on: definitions, mechanisms, key concepts, clinical facts, cause-effect relationships, classifications.
Rules: questions must be specific, answers concise (1–3 sentences), no yes/no questions, no redundancy.
Return ONLY a valid JSON array — no markdown, no commentary.`,
      },
      {
        role: 'user',
        content: `Create 5–12 high-yield Anki flashcards from the text below.

Return ONLY this exact JSON structure (no other text):
[{"front":"Question?","back":"Answer.","tags":["topic"]}]

TEXT:
${text}`,
      },
    ],
    temperature: 0.3,
    max_tokens: 2500,
  });

  const raw = (response.choices[0]?.message?.content ?? '').trim();

  // Extract the first JSON array found in the response
  const match = raw.match(/\[[\s\S]*\]/);
  if (!match) return [];

  try {
    const cards = JSON.parse(match[0]);
    return Array.isArray(cards) ? cards : [];
  } catch {
    return [];
  }
}

async function generateFlashcardsFromChunks(text, onProgress) {
  const chunks = chunkText(text);
  const allCards = [];
  let lastError = null;

  for (let i = 0; i < chunks.length; i++) {
    onProgress(
      (i / chunks.length) * 100,
      `Processing section ${i + 1} of ${chunks.length}…`
    );

    try {
      const cards = await generateFlashcardsForChunk(chunks[i]);
      allCards.push(
        ...cards
          .map((c, j) => ({
            id: `${Date.now()}-${i}-${j}`,
            front: (c.front ?? '').trim(),
            back: (c.back ?? '').trim(),
            tags: Array.isArray(c.tags) ? c.tags : [],
          }))
          .filter((c) => c.front && c.back)
      );
    } catch (err) {
      lastError = err;
      console.error(`Chunk ${i + 1} failed:`, err.message);

      // Auth/billing errors will affect every chunk — fail fast
      if (err.status === 401 || err.status === 403) {
        throw new Error('Invalid OpenAI API key. Check your backend/.env file.');
      }
      if (err.status === 429) {
        throw new Error('OpenAI quota exceeded. Add billing credits at platform.openai.com/settings/billing');
      }
    }
  }

  // If nothing came back and we had errors, surface the real reason
  if (allCards.length === 0 && lastError) {
    throw new Error(`OpenAI error: ${lastError.message}`);
  }

  onProgress(100, 'All sections processed!');
  return allCards;
}

module.exports = { generateFlashcardsFromChunks };
