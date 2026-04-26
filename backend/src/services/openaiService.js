const OpenAI = require('openai');

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ~600 words ≈ 800 tokens per chunk — right-sized for 5–8 focused cards
const WORDS_PER_CHUNK = 600;
const MAX_CHUNKS = 30;
const ANALYSIS_MAX_WORDS = 3000;
const MIN_TOTAL_CARDS = 20;
const MAX_TOTAL_CARDS = 150;
const TOKENS_PER_CARD = 75; // target: 1 card per 75 input tokens

function estimateTokens(text) {
  return Math.round(text.split(/\s+/).length * 1.33);
}

function computeTargetCards(totalTokens, numChunks) {
  const raw = Math.round(totalTokens / TOKENS_PER_CARD);
  const total = Math.max(MIN_TOTAL_CARDS, Math.min(MAX_TOTAL_CARDS, raw));
  const perChunk = Math.max(5, Math.min(10, Math.ceil(total / numChunks)));
  return { total, perChunk };
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
  return chunks.slice(0, MAX_CHUNKS);
}

// Light deduplication — removes exact and near-identical card fronts
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

// Global document analysis — subject, domain, exam focus (one call, non-fatal)
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

// Stage 1 (per chunk): Extract structured learning content — fast, cheap
async function summarizeChunk(text) {
  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: 'You are an expert educator. Extract structured learning content from text.',
      },
      {
        role: 'user',
        content: `Analyze this text and return ONLY a valid JSON object (no markdown):
{
  "summary": "2–3 sentence summary",
  "core_concepts": ["concept1", "concept2"],
  "mechanisms": ["mechanism1"],
  "relationships": ["A causes B", "X leads to Y"],
  "high_yield_facts": ["fact1", "fact2", "fact3"]
}

TEXT:
${text}`,
      },
    ],
    temperature: 0.1,
    max_tokens: 500,
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

// Stage 2 (per chunk): Generate cards using summary + original text + context
async function generateFlashcardsForChunk(text, chunkSummary, docContext, targetCards) {
  const contextBlock = docContext
    ? `DOCUMENT CONTEXT:
Subject: ${docContext.subject_area}
Core Themes: ${(docContext.core_themes ?? []).join(', ')}
Exam Focus: ${docContext.exam_focus}

`
    : '';

  const summaryBlock = chunkSummary
    ? `CHUNK ANALYSIS — use this to guide card selection:
Summary: ${chunkSummary.summary}
Core Concepts: ${(chunkSummary.core_concepts ?? []).join(', ')}
Mechanisms: ${(chunkSummary.mechanisms ?? []).join(', ')}
Key Relationships: ${(chunkSummary.relationships ?? []).join(', ')}
High-Yield Facts: ${(chunkSummary.high_yield_facts ?? []).join(', ')}

`
    : '';

  const medicalLayer =
    docContext?.is_medical || docContext?.is_scientific
      ? `MEDICAL/SCIENTIFIC CONTENT — apply these extra rules:
- Prioritize pathophysiology, mechanisms of action, and clinical correlations
- Include classic presentations, diagnostic clues, and first-line treatments
- Create "pitfall" cards where student confusion is common (tag: "pitfall")
- Focus on high-yield exam facts; skip low-yield trivia
- Use mnemonics ONLY when genuinely more efficient than a plain card

`
      : '';

  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `You are a world-class Anki deck creator trained in cognitive science, spaced repetition, and medical education.

CORE RULES (non-negotiable):
1. Minimum Information Principle — exactly ONE idea per card, always
2. Questions must be specific, atomic, and answerable in under 10 seconds
3. Never use vague stems like "Explain...", "Describe...", "What do you know about..."
4. Prioritize understanding mechanisms and cause–effect over rote memorization
5. Break complex topics into multiple focused cards rather than one dense card

QUANTITY RULES (CRITICAL):
- Generate proportional to content density — do NOT stop early at a fixed small number
- Target: ${targetCards} cards for this chunk
- NEVER return fewer than 5 cards unless the chunk has fewer than 3 distinct concepts
- Cover ALL major concepts before stopping
- Conceptually dense chunks → up to 10 cards

CARD TYPE SELECTION:
• Basic (Q/A)  → definitions, facts, single relationships, clinical presentations, named effects
• Cloze        → lists, sequences, pathways, comparisons, key terminology in context

FORMATS:
Basic: {"type":"basic","front":"Specific question?","back":"Concise answer.","tags":["topic"]}
Cloze: {"type":"cloze","front":"The {{c1::key term}} does X in Y context.","back":"","tags":["topic"]}
Multi-cloze: {{c1::first}} and {{c2::second}} for independent testable slots.

SELF-VALIDATION per card:
✓ Answerable in <10 seconds?
✓ Tests exactly ONE idea?
✓ Unambiguous — only one correct answer?
✓ Worth knowing for a high-performing student?
Revise or discard if any answer is NO.

OUTPUT: Return ONLY a valid JSON array. No markdown fences, no commentary.`,
      },
      {
        role: 'user',
        content: `${contextBlock}${summaryBlock}${medicalLayer}Generate ${targetCards}–${Math.min(targetCards + 2, 10)} expert-quality Anki flashcards from the text below.

IMPORTANT: Cover ALL major concepts in the chunk. Do not stop after a small fixed number. Choose the best card type for each concept. Mimic expert human-made Anki decks: high-yield, minimal, precise.

TEXT:
${text}

Return ONLY: [{"type":"basic"|"cloze","front":"...","back":"...","tags":["..."]}]`,
      },
    ],
    temperature: 0.35,
    max_tokens: 3500,
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
  const totalTokens = estimateTokens(text);
  const { total: targetTotal } = computeTargetCards(totalTokens, chunks.length);
  const allCards = [];
  let lastError = null;

  console.log(
    `Document: ~${totalTokens} tokens, ${chunks.length} chunks, target ${targetTotal} cards`
  );

  // Global document analysis (non-fatal)
  onProgress(0, 'Analyzing document…');
  let docContext = null;
  try {
    docContext = await analyzeDocument(text);
  } catch (err) {
    console.warn('Document analysis skipped:', err.message);
  }

  // Per-chunk two-stage pipeline
  for (let i = 0; i < chunks.length; i++) {
    // Recalculate per-chunk target dynamically based on cards still needed
    const remaining = targetTotal - allCards.length;
    const chunksLeft = chunks.length - i;
    const dynamicTarget = Math.max(5, Math.min(10, Math.ceil(remaining / chunksLeft)));

    onProgress(
      (i / chunks.length) * 100,
      `Processing section ${i + 1} of ${chunks.length}…`
    );

    try {
      // Stage 1: Understand the chunk
      let chunkSummary = null;
      try {
        chunkSummary = await summarizeChunk(chunks[i]);
      } catch (err) {
        console.warn(`Chunk ${i + 1} summary skipped:`, err.message);
      }

      // Stage 2: Generate cards using the summary
      const cards = await generateFlashcardsForChunk(
        chunks[i],
        chunkSummary,
        docContext,
        dynamicTarget
      );

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

  // Light deduplication pass
  const deduplicated = deduplicateCards(allCards);
  console.log(
    `Generated ${allCards.length} cards → ${deduplicated.length} after deduplication`
  );

  onProgress(100, 'All sections processed!');
  return deduplicated;
}

module.exports = { generateFlashcardsFromChunks };
