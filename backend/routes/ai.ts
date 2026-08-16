import { Router, Request, Response } from 'express';
import { GoogleGenAI } from '@google/genai';

const router = Router();

// The Gemini key never leaves this process — it is read from server-side env
// only (not exposed via vite's client `define`, unlike the old client-side calls).
let _ai: GoogleGenAI | null = null;
const getAI = (): GoogleGenAI => {
  if (_ai) return _ai;
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || '';
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set in .env — AI proxy unavailable.');
  _ai = new GoogleGenAI({ apiKey });
  return _ai;
};

// ── POST /api/ai/generate ─────────────────────────────────────────────────────
// Single-shot proxy for ai.models.generateContent — same request/response shape
// the client used to build directly against the SDK. Body: { model, contents, config }.
router.post('/generate', async (req: Request, res: Response) => {
  const { model, contents, config } = req.body as { model?: string; contents?: unknown; config?: unknown };
  if (!model || !contents) {
    return res.status(400).json({ error: 'model and contents are required.' });
  }
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({ model, contents: contents as any, config: config as any });
    return res.status(200).json({ text: response.text, candidates: response.candidates });
  } catch (err) {
    console.error('[AI] generate failed:', err);
    return res.status(502).json({ error: 'AI generation failed.' });
  }
});

// ── POST /api/ai/chat-stream ──────────────────────────────────────────────────
// Streaming proxy for multi-turn chat (replaces ai.chats.create().sendMessageStream()).
// Stateless — the client sends the full prior turn history each time, same as the
// SDK's Chat object does internally. Body: { model, history, message, config }.
// Response body is plain-text, streamed as chunks arrive.
router.post('/chat-stream', async (req: Request, res: Response) => {
  const { model, history, message, config } = req.body as { model?: string; history?: unknown[]; message?: string; config?: unknown };
  if (!model || !message) {
    return res.status(400).json({ error: 'model and message are required.' });
  }
  try {
    const ai = getAI();
    const contents = [...(history ?? []), { role: 'user', parts: [{ text: message }] }];
    const stream = await ai.models.generateContentStream({ model, contents: contents as any, config: config as any });
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    for await (const chunk of stream) {
      if (chunk.text) res.write(chunk.text);
    }
    res.end();
  } catch (err) {
    console.error('[AI] chat-stream failed:', err);
    if (!res.headersSent) res.status(502).json({ error: 'AI streaming failed.' });
    else res.end();
  }
});

export default router;
