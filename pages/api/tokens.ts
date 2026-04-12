// pages/api/tokens.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const today = new Date().toISOString().split('T')[0];
  const redisKey = `groq_tokens_${today}`;
  const total = (await redis.get<number>(redisKey)) ?? 0;
  return res.status(200).json({ total, date: today });
}