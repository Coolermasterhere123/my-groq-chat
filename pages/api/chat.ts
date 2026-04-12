// pages/api/chat.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import Groq from 'groq-sdk';

const API_KEYS = [
  process.env.GROQ_API_KEY_1!,
  process.env.GROQ_API_KEY_2!,
  process.env.GROQ_API_KEY_3!,
].filter(Boolean);

type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

interface ChatRequestBody {
  messages: ChatMessage[];
  model?: string;
  temperature?: number;
  max_tokens?: number;
  secret?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const body: ChatRequestBody = req.body;

  if (body.secret !== process.env.API_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!body?.messages || !Array.isArray(body.messages)) {
    return res.status(400).json({ error: '`messages` array is required' });
  }

  const model = body.model ?? 'llama-3.1-8b-instant';

  const shuffled = [...API_KEYS].sort(() => Math.random() - 0.5);

  for (let attempt = 0; attempt < shuffled.length; attempt++) {
    const groq = new Groq({ apiKey: shuffled[attempt] });
    try {
      const response = await groq.chat.completions.create({
        model,
        messages: body.messages,
        temperature: body.temperature ?? 0.7,
        max_tokens: body.max_tokens ?? 1024,
      });
      const reply = response.choices[0].message.content;
      return res.status(200).json({ reply });
    } catch (err: any) {
      const isRateLimit = err.status === 429;
      const isLastAttempt = attempt === shuffled.length - 1;
      if (isRateLimit && !isLastAttempt) {
        continue;
      }
      console.error('Groq error', err);
      return res.status(err.status || 500).json({ error: err.message ?? 'Internal Server Error' });
    }
  }
}