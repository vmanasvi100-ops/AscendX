// Client-side shim for AI calls — replaces direct `new GoogleGenAI({apiKey})` usage.
// All requests are proxied through the backend (backend/routes/ai.ts) so the
// Gemini API key never ships in the browser bundle. Call shapes mirror the
// @google/genai SDK closely so existing prompt/schema code needed no changes.

export interface AiGenerateResult {
  text: string;
  candidates?: any[];
}

export const generateContent = async (params: { model: string; contents: any; config?: any }): Promise<AiGenerateResult> => {
  const res = await fetch('/api/ai/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `AI request failed (${res.status})`);
  }
  return res.json();
};

export interface ChatStreamChunk {
  text: string;
}

export interface ChatSession {
  sendMessageStream: (params: { message: string }) => Promise<AsyncGenerator<ChatStreamChunk>>;
}

// Mimics ai.chats.create(...) — returns an object with the same sendMessageStream()
// shape the SDK's Chat object exposes, so calling code (e.g. ResumeCoach.tsx) is
// unchanged. History is tracked client-side and resent each turn (stateless proxy —
// avoids needing server-side session storage).
export const createChatSession = (
  model: string,
  config: { systemInstruction?: string } & Record<string, any> = {}
): ChatSession => {
  let history: any[] = [];

  return {
    sendMessageStream: async ({ message }: { message: string }) => {
      const userContent = { role: 'user', parts: [{ text: message }] };
      const res = await fetch('/api/ai/chat-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, history, message, config }),
      });
      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Chat stream failed (${res.status})`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      async function* stream(): AsyncGenerator<ChatStreamChunk> {
        let fullText = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunkText = decoder.decode(value, { stream: true });
          if (!chunkText) continue;
          fullText += chunkText;
          yield { text: chunkText };
        }
        history = [...history, userContent, { role: 'model', parts: [{ text: fullText }] }];
      }

      return stream();
    },
  };
};
