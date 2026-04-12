// pages/index.tsx
import { useState, useRef, FormEvent } from 'react';
import Head from 'next/head';
import styles from '../styles/home.module.css';

type Message = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

type TokenInfo = {
  keyIndex: number;
  tokensUsed: number;
  promptTokens: number;
  completionTokens: number;
};

const API_SECRET = 'getyourownchatbot';
const DAILY_LIMIT = 100000;

const LANG_TO_EXT: Record<string, string> = {
  html: 'html', javascript: 'js', js: 'js', typescript: 'ts', ts: 'ts',
  python: 'py', py: 'py', css: 'css', json: 'json', bash: 'sh', sh: 'sh',
  markdown: 'md', md: 'md', txt: 'txt', csv: 'csv',
};

function extractCodeBlocks(text: string) {
  const regex = /```(\w+)?\n([\s\S]*?)```/g;
  const blocks: { lang: string; code: string; filename: string }[] = [];
  let match;
  const count: Record<string, number> = {};
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

function renderInline(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} style={{ color: '#1a56db' }}>{part.slice(2, -2)}</strong>;
    }
    return <span key={i}>{part}</span>;
  });
}

function renderText(text: string): React.ReactNode {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    if (line === '') { i++; continue; }
    const numMatch = line.match(/^(\d+)\.\s+(.*)/);
    if (numMatch) {
      const items: React.ReactNode[] = [];
      while (i < lines.length) {
        const l = lines[i].trim();
        const m = l.match(/^(\d+)\.\s+(.*)/);
        if (m) { items.push(<li key={i} className={styles.listItem}>{renderInline(m[2])}</li>); i++; }
        else if (l === '') { i++; break; }
        else break;
      }
      elements.push(<ol key={`ol-${i}`} className={styles.orderedList}>{items}</ol>);
      continue;
    }
    if (line.startsWith('- ') || line.startsWith('* ')) {
      const items: React.ReactNode[] = [];
      while (i < lines.length) {
        const l = lines[i].trim();
        if (l.startsWith('- ') || l.startsWith('* ')) { items.push(<li key={i} className={styles.listItem}>{renderInline(l.slice(2))}</li>); i++; }
        else if (l === '') { i++; break; }
        else break;
      }
      elements.push(<ul key={`ul-${i}`} className={styles.unorderedList}>{items}</ul>);
      continue;
    }
    if (line.startsWith('### ')) { elements.push(<h3 key={i} className={styles.heading3}>{line.slice(4)}</h3>); i++; continue; }
    if (line.startsWith('## ')) { elements.push(<h2 key={i} className={styles.heading2}>{line.slice(3)}</h2>); i++; continue; }
    if (line.startsWith('# ')) { elements.push(<h1 key={i} className={styles.heading1}>{line.slice(2)}</h1>); i++; continue; }
    elements.push(<p key={i} className={styles.paragraph}>{renderInline(line)}</p>);
    i++;
  }
  return <>{elements}</>;
}

function MessageContent({ content }: { content: string }) {
  const blocks = extractCodeBlocks(content);
  const parts = content.split(/```(?:\w+)?\n[\s\S]*?```/g);
  return (
    <div>
      {parts.map((part, i) => (
        <span key={i}>
          {renderText(part)}
          {blocks[i] && (
            <div className={styles.codeBlock}>
              <div className={styles.codeHeader}>
                <span className={styles.codeLang}>{blocks[i].lang}</span>
                <button className={styles.downloadBtn} onClick={() => downloadFile(blocks[i].filename, blocks[i].code)}>
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

function TokenPanel({ sessionTokens, lastInfo }: { sessionTokens: number; lastInfo: TokenInfo | null }) {
  const pct = Math.min((sessionTokens / DAILY_LIMIT) * 100, 100);
  const color = pct > 80 ? '#ef4444' : pct > 50 ? '#f59e0b' : '#10b981';

  return (
    <div className={styles.tokenPanel}>
      <div className={styles.tokenTitle}>🔑 Token Usage This Session</div>
      <div className={styles.tokenBar}>
        <div className={styles.tokenFill} style={{ width: `${pct}%`, background: color }} />
      </div>
      <div className={styles.tokenStats}>
        <span>{sessionTokens.toLocaleString()} tokens used</span>
        <span>{(DAILY_LIMIT - sessionTokens).toLocaleString()} remaining</span>
      </div>
      {lastInfo && (
        <div className={styles.tokenDetail}>
          Last request: Key #{lastInfo.keyIndex} · {lastInfo.tokensUsed} tokens
          (prompt: {lastInfo.promptTokens} + response: {lastInfo.completionTokens})
        </div>
      )}
      {pct > 80 && <div className={styles.tokenWarning}>⚠️ Running low on tokens!</div>}
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
  const [sessionTokens, setSessionTokens] = useState(0);
  const [lastTokenInfo, setLastTokenInfo] = useState<TokenInfo | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => setFileContent(ev.target?.result as string);
    reader.readAsText(file);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() && !fileContent) return;

    let userContent = input.trim();
    if (fileContent) userContent += `\n\n--- Contents of ${fileName} ---\n${fileContent}`;

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
        setMessages([...updated, { role: 'assistant', content: `⚠️ Error: ${data.error}${data.resetIn ? ` Try again in ${data.resetIn}` : ''}` }]);
      } else {
        setMessages([...updated, { role: 'assistant', content: data.reply }]);
        if (data.tokenInfo) {
          setSessionTokens(prev => prev + data.tokenInfo.tokensUsed);
          setLastTokenInfo(data.tokenInfo);
        }
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
        <TokenPanel sessionTokens={sessionTokens} lastInfo={lastTokenInfo} />
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
            <input ref={fileRef} type="file" accept=".txt,.csv,.html,.py,.js,.ts,.json,.md" onChange={handleFile} style={{ display: 'none' }} />
          </label>
          {fileName && <span className={styles.fileName}>📄 {fileName}</span>}
          <button className={styles.button} type="submit" disabled={loading}>Send</button>
        </form>
      </main>
    </>
  );
}