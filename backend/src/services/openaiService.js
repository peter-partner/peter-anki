const OpenAI = require('openai');

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const WORDS_PER_CHUNK = 1500;
const MAX_CHUNKS = 15;
const ANALYSIS_MAX_WORDS = 3000;

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

// Phase 1: Understand the document — subject, domain, exam focus
async function analyzeDocument(text) {
  const sample = text.split(/\s+/).slice(0, ANALYSIS_MAX_WORDS).join(' ');

  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: 'You are an expert educator. Analyze documents to identify their subject, domain, and learning objectives.',
      },
      {
        role: 'user',
        content: `Analyze this document excerpt and return ONLY a valid JSON object (no markdown, no commentary):
{
  "subject_area": "specific subject, e.g. 'Cardiology — Heart Failure'",
  "is_medical": true or false,
  "is_scientific": true or false,
  "core_themes": ["theme1", "theme2"],
  "key_concepts": ["concept1", "concept2"],
  "exam_focus": "one sentence describing what a student is typically tested on"
}

DOCUMENT EXCERPT:
${sample}`,
      },
    ],
    temperature: 0.1,
    max_tokens: 400,
  });

  const raw = (response.choices[0]?.message?.content ?? '').trim();
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;

  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

// Phase 2: Generate expert-quality cards for one chunk, informed by document context
async function generateFlashcardsForChunk(text, docContext) {
  const contextBlock = docContext
    ? `DOCUMENT CONTEXT:
Subject: ${docContext.subject_area}
Core Themes: ${(docContext.core_themes ?? []).join(', ')}
Exam Focus: ${docContext.exam_focus}

`
    : '';

  const medicalLayer =
    docContext?.is_medical || docContext?.is_scientific
      ? `MEDICAL/SCIENTIFIC CONTENT — apply these extra rules:
- Prioritize pathophysiology, mechanisms of action, and clinical correlations
- Include classic presentations, diagnostic clues, and first-line treatments
- Create "pitfall" cards where student confusion is common (label tag "pitfall")
- Focus on high-yield exam facts; skip low-yield trivia
- Use mnemonics ONLY when genuinely more efficient than a plain card

`
      : '';

  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `You are a world-class Anki deck creator trained in cognitive science, spaced repetition, and medical education. Your cards are used by top-scoring medical students.

CORE RULES (non-negotiable):
1. Minimum Information Principle — exactly ONE idea per card, always
2. Questions must be specific, atomic, and answerable in under 10 seconds
3. Never use vague stems like "Explain...", "Describe...", or "What do you know about..."
4. Prioritize understanding mechanisms and cause–effect over rote facts
5. Break complex topics into multiple focused cards rather than one dense card

CARD TYPE SELECTION:
• Basic (Q/A)   → definitions, direct facts, single relationships, clinical presentations, named effects
• Cloze         → lists, sequences, pathways, comparisons, key terminology in context

BASIC FORMAT (JSON):
{"type":"basic","front":"Specific question?","back":"Concise, complete answer.","tags":["topic"]}

CLOZE FORMAT (JSON):
{"type":"cloze","front":"The {{c1::key term}} does X in Y context.","back":"","tags":["topic"]}
Multi-concept cloze: use {{c1::...}} {{c2::...}} for independent testable slots.

SELF-VALIDATION — apply to every card before including it:
✓ Answerable in <10 seconds?
✓ Tests exactly ONE idea?
✓ Unambiguous — only one correct answer?
✓ Would a high-performing student actually need to know this?
If any answer is NO → revise or discard.

OUTPUT: Return ONLY a valid JSON array. No markdown fences, no commentary, no explanations.`,
      },
      {
        role: 'user',
        content: `${contextBlock}${medicalLayer}Generate 5–15 expert-quality Anki flashcards from the text below.

Choose the BEST card type for each concept. Mimic expert human-made Anki decks: high-yield, minimal, precise. Every card must pass the self-validation check.

TEXT:
${text}

Return ONLY: [{"type":"basic"|"cloze","front":"...","back":"...","tags":["..."]}]`,
      },
    ],
    temperature: 0.3,
    max_tokens: 3000,
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

async function generateFlashcardsFromChunks(text, onProgress) {
  const chunks = chunkText(text);
  const allCards = [];
  let lastError = null;

  // Phase 1 — analyze the full document for context
  onProgress(0, 'Analyzing document…');
  let docContext = null;
  try {
    docContext = await analyzeDocument(text);
  } catch (err) {
    // Non-fatal: generation continues without context
    console.warn('Document analysis skipped:', err.message);
  }

  // Phase 2 — generate cards per chunk, informed by context
  for (let i = 0; i < chunks.length; i++) {
    onProgress(
      (i / chunks.length) * 100,
      `Generating cards for section ${i + 1} of ${chunks.length}…`
    );

    try {
      const cards = await generateFlashcardsForChunk(chunks[i], docContext);
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

  onProgress(100, 'All sections processed!');
  return allCards;
}

module.exports = { generateFlashcardsFromChunks };
