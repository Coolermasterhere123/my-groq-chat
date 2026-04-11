// pages/api/chat.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import Groq from 'groq-sdk';

type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

interface ChatRequestBody {
  messages: ChatMessage[];
  model?: string;
  temperature?: number;
  max_tokens?: number;
}

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! });

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

  const model = body.model ?? 'llama3-8b-8192';
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
    console.error('Groq error', err);
    return res.status(err.status || 500).json({ error: err.message ?? 'Internal Server Error' });
  }
}
