const fs = require('fs');

async function extractTextFromPDF(filePath) {
  // Lazy-require to avoid pdf-parse's test-file side-effect on import
  const pdfParse = require('pdf-parse');
  const dataBuffer = fs.readFileSync(filePath);
  const data = await pdfParse(dataBuffer);

  return {
    text: cleanText(data.text),
    pageCount: data.numpages,
  };
}

function cleanText(text) {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\u0000/g, '')
    .trim();
}

module.exports = { extractTextFromPDF };
