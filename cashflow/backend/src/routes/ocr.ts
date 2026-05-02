import type { FastifyInstance } from 'fastify';
import { createWorker } from 'tesseract.js';

export async function ocrRoutes(app: FastifyInstance) {
  app.post('/scan', async (req, reply) => {
    const data = await req.file();
    if (!data) return reply.code(400).send({ error: 'Fichier manquant' });

    const buffer = await data.toBuffer();

    const worker = await createWorker('fra+eng');
    const { data: ocrResult } = await worker.recognize(buffer);
    await worker.terminate();

    // Extract key data using regex on OCR text
    const text = ocrResult.text;
    const extracted = extractReceiptData(text);

    return reply.send({
      rawText: text,
      confidence: ocrResult.confidence,
      extracted,
    });
  });
}

function extractReceiptData(text: string) {
  const amountPatterns = [
    /(?:total|montant|net à payer|ttc)[\s:]*([0-9\s.,]+)/gi,
    /([0-9]{3,}(?:[.,][0-9]{3})*(?:[.,][0-9]{2})?)\s*(?:fcfa|xof|€|eur)/gi,
  ];

  const datePattern = /\b(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})\b/g;
  const invoicePattern = /(?:facture|invoice|n°|num[eé]ro)[\s:]*([A-Z0-9\-]+)/gi;

  let amount: number | undefined;
  for (const pattern of amountPatterns) {
    const match = pattern.exec(text);
    if (match) {
      const raw = match[1].replace(/\s/g, '').replace(',', '.');
      const parsed = parseFloat(raw);
      if (!isNaN(parsed) && parsed > 0) {
        amount = parsed;
        break;
      }
    }
  }

  const dateMatch = datePattern.exec(text);
  const invoiceMatch = invoicePattern.exec(text);

  // Extract vendor from first non-empty line (heuristic)
  const lines = text.split('\n').map((l) => l.trim()).filter((l) => l.length > 3);
  const vendor = lines[0] ?? undefined;

  return {
    amount,
    date: dateMatch ? dateMatch[1] : undefined,
    invoiceNumber: invoiceMatch ? invoiceMatch[1] : undefined,
    vendor,
  };
}
