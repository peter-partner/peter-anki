require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

if (!process.env.OPENAI_API_KEY) {
  console.error('\n❌  OPENAI_API_KEY is not set.');
  console.error('    Copy backend/.env.example → backend/.env and add your key.\n');
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3001;

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.use('/api', require('./src/routes/flashcards'));

app.get('/health', (_req, res) =>
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
);

app.listen(PORT, () =>
  console.log(`✓  PDF-to-Anki backend running at http://localhost:${PORT}`)
);
