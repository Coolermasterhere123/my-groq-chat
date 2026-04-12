// pages/api/chat.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import Groq from 'groq-sdk';
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

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
  const shuffled = [...API_KEYS]
    .map((key, i) => ({ key, index: i + 1 }))
    .sort(() => Math.random() - 0.5);

  for (let attempt = 0; attempt < shuffled.length; attempt++) {
    const { key, index } = shuffled[attempt];
    const groq = new Groq({ apiKey: key });
    try {
      const response = await groq.chat.completions.create({
        model,
        messages: body.messages,
        temperature: body.temperature ?? 0.7,
        max_tokens: body.max_tokens ?? 1024,
      });

      const reply = response.choices[0].message.content;
      const usage = response.usage;
      const tokensUsed = usage?.total_tokens ?? 0;

      // Save to Redis - increment global token counter
      const today = new Date().toISOString().split('T')[0];
      const redisKey = `groq_tokens_${today}`;
      const newTotal = await redis.incrby(redisKey, tokensUsed);
      // Set expiry to 2 days so it auto cleans up
      await redis.expire(redisKey, 172800);

      const tokenInfo = {
        keyIndex: index,
        tokensUsed,
        promptTokens: usage?.prompt_tokens ?? 0,
        completionTokens: usage?.completion_tokens ?? 0,
        totalToday: newTotal,
        date: today,
      };

      return res.status(200).json({ reply, tokenInfo });
    } catch (err: any) {
      const isRateLimit = err.status === 429;
      const isLastAttempt = attempt === shuffled.length - 1;
      if (isRateLimit && !isLastAttempt) continue;
      const resetMatch = err.message?.match(/try again in (\S+)/i);
      const resetIn = resetMatch ? resetMatch[1] : null;
      console.error('Groq error', err);
      return res.status(err.status || 500).json({
        error: err.message ?? 'Internal Server Error',
        resetIn,
      });
    }
  }
}