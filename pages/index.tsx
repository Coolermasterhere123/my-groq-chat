// pages/index.tsx
import { useState, useRef, FormEvent } from 'react';
import Head from 'next/head';
import styles from '../styles/home.module.css';

type Message = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export default function Home() {
  // -----------------------------------------------------------------
  // 1️⃣ Local conversation state
  // -----------------------------------------------------------------
  const [history, setHistory] = useState<Message[]>([
    { role: 'system', content: 'You are a helpful AI assistant.' },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // -----------------------------------------------------------------
  // 2️⃣ Scroll helper
  // -----------------------------------------------------------------
  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // -----------------------------------------------------------------
  // 3️⃣ Submit handler – talks to /api/chat
  // -----------------------------------------------------------------
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMsg: Message = { role: 'user', content: input };
    const newHistory = [...history, userMsg];
    setHistory(newHistory);
    setInput('');
    setLoading(true);

    try {
      const resp = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newHistory }),
      });

      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'API error');

      const assistantMsg: Message = {
        role: 'assistant',
        content: data.reply,
      };
      setHistory((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      console.error(err);
      const errorMsg: Message = {
        role: 'assistant',
        content: `⚠️ Error: ${err.message}`,
      };
      setHistory((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
      scrollToBottom();
    }
  };

  // -----------------------------------------------------------------
  // 4️⃣ Render UI
  // -----------------------------------------------------------------
  return (
    <>
      <Head>
        <title>Groq Chat on Vercel</title>
        <meta
          name="description"
          content="A tiny Groq‑powered chat demo hosted on Vercel"
        />
      </Head>

      <main className={styles.main}>
        <h1>Groq Chat Demo (Vercel)</h1>

        <div className={styles.chatBox}>
          {history.map((msg, i) => (
            <div
              key={i}
              className={msg.role === 'assistant' ? styles.assistant : styles.user}
            >
              <strong>{msg.role === 'assistant' ? 'Groq' : 'You'}:</strong>{' '}
              {msg.content}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <input
            type="text"
            placeholder="Ask something…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
            className={styles.input}
          />
          <button type="submit" disabled={loading} className={styles.button}>
            {loading ? '…thinking' : 'Send'}
          </button>
        </form>
      </main>
    </>
  );
}
