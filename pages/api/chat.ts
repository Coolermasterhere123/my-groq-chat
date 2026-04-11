// pages/api/chat.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { Groq } from 'groq';

// -------------------------------------------------------------------
// 1️⃣ Initialise Groq client – the key comes from Vercel / .env.local
// -------------------------------------------------------------------
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY!,
});

// -------------------------------------------------------------------
// 2️⃣ Types for the request payload
// -------------------------------------------------------------------
type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

interface ChatRequestBody {
  messages: ChatMessage[];
  model?: string;          // optional override
  temperature?: number;
  max_tokens?: number;
}

// -------------------------------------------------------------------
// 3️⃣ API route handler
// -------------------------------------------------------------------
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const body: ChatRequestBody = req.body;

  if (!body?.messages || !Array.isArray(body.messages)) {
    return res.status(400).json({ error: '`messages` array is required' });
  }

  const model = body.model ?? 'mixtral-8x7b-32768';

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
    console.error('Groq error →', err);
    return res
      .status(err.status || 500)
      .json({ error: err.message ?? 'Internal Server Error' });
  }
}
