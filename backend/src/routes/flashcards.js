const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { extractTextFromPDF } = require('../services/pdfParser');
const { generateFlashcardsFromChunks } = require('../services/openaiService');
const { generateVisualCards } = require('../services/imageService');

const storage = multer.diskStorage({
  destination: (_req, _file, cb) =>
    cb(null, path.join(__dirname, '../../uploads')),
  filename: (_req, _file, cb) =>
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}.pdf`),
});

const upload = multer({
  storage,
  limits: {
    fileSize: (parseInt(process.env.MAX_FILE_SIZE_MB) || 50) * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error('Only PDF files are allowed'));
  },
});

// POST /api/process  →  SSE stream of progress + final flashcards
router.post('/process', upload.single('pdf'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No PDF file uploaded' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const send = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    if (typeof res.flush === 'function') res.flush();
  };

  const filePath = req.file.path;
  const mode = req.body.mode === 'text' ? 'text' : 'visual'; // default: visual

  try {
    send('status', { message: 'Extracting text from PDF…', progress: 5 });

    const { text, pageCount } = await extractTextFromPDF(filePath);

    if (!text || text.trim().length < 50) {
      send('error', {
        message: 'Could not extract readable text. The PDF may be scanned or image-based.',
      });
      return res.end();
    }

    const deckName =
      req.body.deckName ||
      req.file.originalname.replace(/\.pdf$/i, '') ||
      'My Deck';

    send('status', {
      message: `Extracted ${pageCount} pages. Running ${mode === 'text' ? 'Deep Text' : 'Hybrid Visual'} pipeline…`,
      progress: 15,
    });

    // Text pipeline — progress occupies 15→65% (visual) or 15→95% (text)
    const textProgressEnd = mode === 'visual' ? 65 : 95;
    const { cards: textCards, docContext } = await generateFlashcardsFromChunks(
      text,
      (chunkProgress, message) => {
        send('status', {
          message,
          progress: 15 + (chunkProgress / 100) * (textProgressEnd - 15),
        });
      },
      mode
    );

    let flashcards = textCards;

    // Visual pipeline — progress occupies 65→95%
    if (mode === 'visual') {
      send('status', { message: 'Analyzing visual content in PDF…', progress: 65 });

      try {
        const visualCards = await generateVisualCards(
          filePath,
          pageCount,
          docContext,
          (p, message) => {
            send('status', { message, progress: 65 + p * 30 });
          }
        );

        if (visualCards.length > 0) {
          flashcards = [...textCards, ...visualCards];
          console.log(`Merged ${textCards.length} text + ${visualCards.length} visual = ${flashcards.length} total cards`);
        }
      } catch (err) {
        console.warn('Visual pipeline error (continuing with text cards):', err.message);
      }
    }

    if (flashcards.length === 0) {
      send('error', {
        message: 'No flashcards could be generated. Please try a different PDF.',
      });
      return res.end();
    }

    send('complete', {
      flashcards,
      deckName,
      pageCount,
      totalCards: flashcards.length,
      mode,
    });
  } catch (err) {
    console.error('Processing error:', err);
    send('error', { message: err.message || 'An unexpected error occurred' });
  } finally {
    fs.unlink(filePath, () => {});
    res.end();
  }
});

module.exports = router;
