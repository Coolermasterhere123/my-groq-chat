// pages/index.tsx
import { useState, useRef, FormEvent } from 'react';
import Head from 'next/head';
import styles from '../styles/home.module.css';

type Message = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

const API_SECRET = 'getyourownchatbot';

const LANG_TO_EXT: Record<string, string> = {
  html: 'html',
  javascript: 'js',
  js: 'js',
  typescript: 'ts',
  ts: 'ts',
  python: 'py',
  py: 'py',
  css: 'css',
  json: 'json',
  bash: 'sh',
  sh: 'sh',
  markdown: 'md',
  md: 'md',
  txt: 'txt',
  csv: 'csv',
};

function extractCodeBlocks(text: string): { lang: string; code: string; filename: string }[] {
  const regex = /```(\w+)?\n([\s\S]*?)```/g;
  const blocks: { lang: string; code: string; filename: string }[] = [];
  let match;
  let count: Record<string, number> = {};
  while ((match = regex.exec(text)) !== null) {
    const lang = (match[1] || 'txt').toLowerCase();
    const code = match[2];
    const ext = LANG_TO_EXT[lang] || lang;
    count[ext] = (count[ext] || 0) + 1;
    const filename = count[ext] === 1 ? `file.${ext}` : `file${count[ext]}.${ext}`;
    blocks.push({ lang, code, filename });
  }
  return blocks;
}

function downloadFile(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function MessageContent({ content }: { content: string }) {
  const blocks = extractCodeBlocks(content);
  const parts = content.split(/```(?:\w+)?\n[\s\S]*?```/g);

  return (
    <div>
      {parts.map((part, i) => (
        <span key={i}>
          <span style={{ whiteSpace: 'pre-wrap' }}>{part}</span>
          {blocks[i] && (
            <div className={styles.codeBlock}>
              <div className={styles.codeHeader}>
                <span className={styles.codeLang}>{blocks[i].lang}</span>
                <button
                  className={styles.downloadBtn}
                  onClick={() => downloadFile(blocks[i].filename, blocks[i].code)}
                >
                  ⬇️ Download {blocks[i].filename}
                </button>
              </div>
              <pre className={styles.codeContent}><code>{blocks[i].code}</code></pre>
            </div>
          )}
        </span>
      ))}
    </div>
  );
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'system', content: 'You are a helpful AI assistant.' },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      setFileContent(ev.target?.result as string);
    };
    reader.readAsText(file);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() && !fileContent) return;

    let userContent = input.trim();
    if (fileContent) {
      userContent += `\n\n--- Contents of ${fileName} ---\n${fileContent}`;
    }

    const userMessage: Message = { role: 'user', content: userContent };
    const updated = [...messages, userMessage];
    setMessages(updated);
    setInput('');
    setFileContent(null);
    setFileName(null);
    if (fileRef.current) fileRef.current.value = '';
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: updated, secret: API_SECRET }),
      });
      const data = await res.json();
      if (data.error) {
        setMessages([...updated, { role: 'assistant', content: `⚠️ Error: ${data.error}` }]);
      } else {
        setMessages([...updated, { role: 'assistant', content: data.reply }]);
      }
    } catch (err) {
      setMessages([...updated, { role: 'assistant', content: '⚠️ Network error. Please try again.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Head><title>Groq Chat</title></Head>
      <main className={styles.main}>
        <h1 className={styles.title}>Groq Chat Demo (Vercel)</h1>
        <div className={styles.chatBox}>
          {messages.filter(m => m.role !== 'system').map((m, i) => (
            <div key={i} className={m.role === 'user' ? styles.userMsg : styles.groqMsg}>
              <strong>{m.role === 'user' ? 'You' : 'Groq'}:</strong>{' '}
              {m.role === 'assistant' ? <MessageContent content={m.content} /> : m.content}
            </div>
          ))}
          {loading && <div className={styles.groqMsg}><strong>Groq:</strong> Thinking...</div>}
        </div>
        <form onSubmit={handleSubmit} className={styles.form}>
          <input
            className={styles.input}
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Type a message..."
            disabled={loading}
          />
          <label className={styles.fileLabel}>
            📎
            <input
              ref={fileRef}
              type="file"
              accept=".txt,.csv,.html,.py,.js,.ts,.json,.md"
              onChange={handleFile}
              style={{ display: 'none' }}
            />
          </label>
          {fileName && <span className={styles.fileName}>📄 {fileName}</span>}
          <button className={styles.button} type="submit" disabled={loading}>Send</button>
        </form>
      </main>
    </>
  );
}