const OpenAI = require('openai');

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const WORDS_PER_CHUNK = 600;
const MAX_CHUNKS = 30;
const ANALYSIS_MAX_WORDS = 3000;

// Visual mode: moderate density (text cards supplemented by visual cards)
// Text mode: high density, aggressive decomposition
const MODE_CONFIG = {
  visual: { tokensPerCard: 100, minCards: 20, maxCards: 100, minPerChunk: 4, maxPerChunk: 8 },
  text:   { tokensPerCard: 55,  minCards: 30, maxCards: 150, minPerChunk: 6, maxPerChunk: 12 },
};

function estimateTokens(text) {
  return Math.round(text.split(/\s+/).length * 1.33);
}

function computeTargetCards(totalTokens, numChunks, mode) {
  const cfg = MODE_CONFIG[mode] ?? MODE_CONFIG.visual;
  const raw = Math.round(totalTokens / cfg.tokensPerCard);
  const total = Math.max(cfg.minCards, Math.min(cfg.maxCards, raw));
  return { total, cfg };
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

function buildSystemPrompt(mode, targetCards) {
  const isText = mode === 'text';
  const maxTarget = isText ? Math.min(targetCards + 4, 12) : Math.min(targetCards + 2, 8);

  const quantityRules = isText
    ? `QUANTITY RULES — DEEP TEXT MODE (CRITICAL):
- Target ${targetCards}–${maxTarget} cards for this chunk
- NEVER return fewer than 6 cards unless the chunk has fewer than 3 distinct concepts
- Decompose concepts to maximal useful granularity
- Break multi-step mechanisms into individual atomic cards
- Prefer slightly more cards over missing important nuance
- Cover secondary details if clinically or academically relevant
- Cover ALL major AND supporting concepts before stopping`
    : `QUANTITY RULES — HYBRID VISUAL MODE:
- Target ${targetCards}–${maxTarget} cards for this chunk
- Keep density moderate — visual diagram cards supplement this output
- NEVER return fewer than 4 cards unless the chunk has fewer than 3 concepts
- Cover ALL major concepts before stopping`;

  const cardTypes = isText
    ? `CARD TYPE SELECTION — be exhaustive:
• Basic (Q/A)    → definitions, facts, single relationships, clinical presentations
• Cloze          → lists, sequences, pathways, terminology in context
• Comparison     → "How does X differ from Y in context Z?" (basic format)
• Mechanism      → "What is the mechanism by which X causes Y?" — split into atomic steps
• Cause-Effect   → "What is the consequence of X?" — one consequence per card`
    : `CARD TYPE SELECTION:
• Basic (Q/A)  → definitions, facts, single relationships, clinical presentations
• Cloze        → lists, sequences, pathways, comparisons, key terminology in context`;

  return `You are a world-class Anki deck creator trained in cognitive science, spaced repetition, and medical education.

CORE RULES (non-negotiable):
1. Minimum Information Principle — exactly ONE idea per card, always
2. Questions must be specific, atomic, and answerable in under 10 seconds
3. Never use vague stems like "Explain...", "Describe...", "What do you know about..."
4. Prioritize understanding mechanisms and cause–effect over rote memorization
5. Break complex topics into multiple focused cards rather than one dense card

${quantityRules}

${cardTypes}

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

OUTPUT: Return ONLY a valid JSON array. No markdown fences, no commentary.`;
}

async function generateFlashcardsForChunk(text, chunkSummary, docContext, targetCards, mode) {
  const isText = mode === 'text';

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

  const maxTarget = isText ? Math.min(targetCards + 4, 12) : Math.min(targetCards + 2, 8);

  const instruction = isText
    ? `Generate ${targetCards}–${maxTarget} expert-quality Anki flashcards from the text below.

DEEP TEXT MODE: Be exhaustive. Decompose every concept to its most granular testable form. Break mechanisms into atomic steps. Create comparison and cause-effect cards. Cover secondary details if relevant.`
    : `Generate ${targetCards}–${maxTarget} expert-quality Anki flashcards from the text below.

HYBRID VISUAL MODE: Focus on core concepts. Diagram-based visual cards will supplement this output — avoid duplicating what's better shown visually.`;

  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: buildSystemPrompt(mode, targetCards) },
      {
        role: 'user',
        content: `${contextBlock}${summaryBlock}${medicalLayer}${instruction}

TEXT:
${text}

Return ONLY: [{"type":"basic"|"cloze","front":"...","back":"...","tags":["..."]}]`,
      },
    ],
    temperature: isText ? 0.4 : 0.35,
    max_tokens: isText ? 4000 : 3500,
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

// Returns { cards, docContext } so the route can share context with the visual pipeline
async function generateFlashcardsFromChunks(text, onProgress, mode = 'visual') {
  const chunks = chunkText(text);
  const totalTokens = estimateTokens(text);
  const { total: targetTotal, cfg } = computeTargetCards(totalTokens, chunks.length, mode);
  const allCards = [];
  let lastError = null;

  console.log(`[${mode.toUpperCase()} MODE] ~${totalTokens} tokens, ${chunks.length} chunks, target ${targetTotal} cards`);

  onProgress(0, 'Analyzing document…');
  let docContext = null;
  try {
    docContext = await analyzeDocument(text);
  } catch (err) {
    console.warn('Document analysis skipped:', err.message);
  }

  for (let i = 0; i < chunks.length; i++) {
    const remaining = targetTotal - allCards.length;
    const chunksLeft = chunks.length - i;
    const dynamicTarget = Math.max(
      cfg.minPerChunk,
      Math.min(cfg.maxPerChunk, Math.ceil(remaining / chunksLeft))
    );

    onProgress(
      (i / chunks.length) * 100,
      `Processing section ${i + 1} of ${chunks.length}…`
    );

    try {
      let chunkSummary = null;
      try {
        chunkSummary = await summarizeChunk(chunks[i]);
      } catch (err) {
        console.warn(`Chunk ${i + 1} summary skipped:`, err.message);
      }

      const cards = await generateFlashcardsForChunk(
        chunks[i], chunkSummary, docContext, dynamicTarget, mode
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

  const deduplicated = deduplicateCards(allCards);
  console.log(`Text cards: ${allCards.length} → ${deduplicated.length} after deduplication`);

  onProgress(100, 'Text analysis complete!');
  return { cards: deduplicated, docContext };
}

module.exports = { generateFlashcardsFromChunks };
