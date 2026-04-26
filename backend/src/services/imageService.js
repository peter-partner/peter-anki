const OpenAI = require('openai');
const fs = require('fs');
const os = require('os');
const path = require('path');

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MAX_PAGES_VISUAL = 20;

async function extractPageAsBase64(filePath, pageNum, tmpDir) {
  // pdf2pic requires GraphicsMagick or ImageMagick on the system.
  // On Render: add "apt-get install -y graphicsmagick" to your Build Command.
  const { fromPath } = require('pdf2pic');

  const convert = fromPath(filePath, {
    density: 150,
    saveFilename: `page-${pageNum}-${Date.now()}`,
    savePath: tmpDir,
    format: 'png',
    width: 1200,
    height: 1600,
  });

  const result = await convert(pageNum, { responseType: 'base64' });
  return result?.base64 ?? null;
}

async function analyzePageForCards(base64, pageNum, docContext) {
  const contextNote = docContext ? `Document subject: ${docContext.subject_area}. ` : '';
  const medicalNote =
    docContext?.is_medical || docContext?.is_scientific
      ? 'This is medical/scientific content — focus on anatomical labels, pathway diagrams, biochemical structures, clinical decision trees, and physiological charts.'
      : '';

  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `You are an expert Anki flashcard creator for visual learning. Analyze educational images to create high-yield flashcards from diagrams, figures, tables, and charts.

RULES:
- Generate cards ONLY if the page has meaningful visual content (diagrams, labeled figures, tables, flowcharts, chemical structures, anatomical drawings, graphs)
- If the page is mostly plain text paragraphs, return []
- 5–15 cards per visual page; test ONE specific element per card
- Questions must reference visible content specifically (not vaguely)
- Answers must be concise

FORMATS:
Basic: {"type":"basic","front":"Specific question about the visual?","back":"Concise answer.","tags":["visual","topic"]}
Cloze: {"type":"cloze","front":"In the diagram, {{c1::key term}} connects to X.","back":"","tags":["visual","topic"]}

Return ONLY a valid JSON array. No markdown, no commentary.`,
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `${contextNote}${medicalNote}

Analyze page ${pageNum}. Generate 5–15 visual flashcards if this page contains diagrams, figures, tables, or labeled visual content. Return [] if it is mostly plain text.

Return ONLY: [{"type":"basic"|"cloze","front":"...","back":"...","tags":["visual","..."]}]`,
          },
          {
            type: 'image_url',
            image_url: {
              url: `data:image/png;base64,${base64}`,
              detail: 'high',
            },
          },
        ],
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

async function generateVisualCards(filePath, pageCount, docContext, onProgress) {
  const pagesToProcess = Math.min(pageCount, MAX_PAGES_VISUAL);
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'anki-vis-'));
  const allCards = [];

  try {
    for (let page = 1; page <= pagesToProcess; page++) {
      onProgress(
        (page - 1) / pagesToProcess,
        `Analyzing visuals on page ${page} of ${pagesToProcess}…`
      );

      let base64 = null;
      try {
        base64 = await extractPageAsBase64(filePath, page, tmpDir);
      } catch (err) {
        // GraphicsMagick not installed — skip visual pipeline entirely
        if (err.message?.includes('gm') || err.message?.includes('GraphicsMagick') || err.code === 'ENOENT') {
          console.warn(
            'GraphicsMagick not found. Visual pipeline disabled.\n' +
            'To enable: add "apt-get install -y graphicsmagick" to your Render Build Command.'
          );
          return [];
        }
        console.warn(`Page ${page} image extraction failed:`, err.message);
        continue;
      }

      if (!base64) continue;

      try {
        const cards = await analyzePageForCards(base64, page, docContext);
        allCards.push(
          ...cards
            .map((c, j) => ({
              id: `vis-${Date.now()}-${page}-${j}`,
              type: c.type || 'basic',
              front: (c.front ?? '').trim(),
              back: (c.back ?? '').trim(),
              tags: Array.isArray(c.tags)
                ? ['visual', ...c.tags.filter((t) => t !== 'visual')]
                : ['visual'],
            }))
            .filter((c) => c.front)
        );
      } catch (err) {
        console.warn(`Vision analysis failed for page ${page}:`, err.message);
      }
    }
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  }

  return allCards;
}

module.exports = { generateVisualCards };
