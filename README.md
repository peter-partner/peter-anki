# PDF to Anki — AI Flashcard Generator

Convert any PDF lecture, textbook, or study material into Anki flashcards using GPT-4o mini. Built for medical students and anyone who loves spaced repetition.

## Features

- **Drag-and-drop** PDF upload with visual feedback
- **AI-powered** Q&A generation focused on definitions, mechanisms, and high-yield facts
- **Real-time progress** via Server-Sent Events
- **Preview & edit** every flashcard before exporting
- **Anki CSV export** — import in one click
- **Dark mode** toggle
- Handles large PDFs via automatic text chunking

---

## Tech Stack

| Layer     | Technology                          |
|-----------|-------------------------------------|
| Frontend  | React 18 + Vite + Tailwind CSS      |
| Backend   | Node.js + Express                   |
| AI        | OpenAI API (`gpt-4o-mini`)          |
| PDF parse | `pdf-parse`                         |
| Upload    | Multer                              |
| Export    | CSV (native Anki import format)     |

---

## Project Structure

```
pdf-to-anki/
├── backend/
│   ├── app.js                        # Express entry point
│   ├── package.json
│   ├── .env.example                  # Copy to .env and add your key
│   └── src/
│       ├── routes/
│       │   └── flashcards.js         # POST /api/process (SSE)
│       └── services/
│           ├── pdfParser.js          # pdf-parse wrapper
│           └── openaiService.js      # Chunking + GPT-4o mini calls
└── frontend/
    ├── index.html
    ├── vite.config.js                # Proxies /api → localhost:3001
    ├── tailwind.config.js
    └── src/
        ├── App.jsx                   # State machine: idle → processing → review
        └── components/
            ├── Header.jsx
            ├── DropZone.jsx          # react-dropzone
            ├── FlashcardEditor.jsx   # Grid + export
            └── FlashcardCard.jsx     # Inline edit / delete
```

---

## Setup

### 1. Clone & navigate

```bash
cd "pdf-to-anki"
```

### 2. Configure backend

```bash
cd backend
cp .env.example .env
```

Open `backend/.env` and add your OpenAI API key:

```
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxx
PORT=3001
MAX_FILE_SIZE_MB=50
```

Get a key at: https://platform.openai.com/api-keys

### 3. Install backend dependencies

```bash
# inside backend/
npm install
```

### 4. Install frontend dependencies

```bash
cd ../frontend
npm install
```

---

## Running Locally

Open **two terminals**:

**Terminal 1 — Backend**
```bash
cd backend
npm run dev
# ✓  PDF-to-Anki backend running at http://localhost:3001
```

**Terminal 2 — Frontend**
```bash
cd frontend
npm run dev
# ➜  Local: http://localhost:5173
```

Open **http://localhost:5173** in your browser.

---

## Using the App

1. **Drop a PDF** onto the upload area (or click to browse)
2. Watch real-time progress as the AI processes each section
3. **Review and edit** the generated flashcards
4. Click **Export for Anki** to download a `.csv` file
5. In Anki: **File → Import → select the CSV** → confirm Basic note type → Import ✓

---

## Importing into Anki (detailed)

1. Open Anki desktop
2. Go to **File → Import**
3. Select your downloaded `.csv` file
4. Confirm settings:
   - **Note Type:** Basic
   - **Separator:** Semicolon (auto-detected from header)
   - **Deck:** shown in the file header (your PDF filename)
5. Click **Import**

Your deck appears in the Anki deck browser immediately.

---

## Configuration

| Variable           | Default | Description                          |
|--------------------|---------|--------------------------------------|
| `OPENAI_API_KEY`   | —       | Required. Your OpenAI API key        |
| `PORT`             | 3001    | Backend port                         |
| `MAX_FILE_SIZE_MB` | 50      | Max PDF upload size in MB            |

### Changing the AI model

In `backend/src/services/openaiService.js`, update:
```js
model: 'gpt-4o-mini',   // change to 'gpt-4o' for higher quality
```

### Adjusting chunk size

In the same file, change `WORDS_PER_CHUNK` (default `1500`) and `MAX_CHUNKS` (default `15`).

---

## Known Limitations

- **Scanned PDFs** (images of text) are not supported — the PDF must contain selectable text
- Very large PDFs (>100 pages) are capped at 15 chunks (~22,500 words) to control API costs
- OpenAI rate limits may slow processing of multi-section PDFs

---

## API Cost Estimate

`gpt-4o-mini` pricing (as of 2025):
- ~$0.15 / 1M input tokens, ~$0.60 / 1M output tokens
- A 20-page lecture PDF ≈ 5,000 tokens input → **< $0.01 per PDF**

---

## License

MIT
