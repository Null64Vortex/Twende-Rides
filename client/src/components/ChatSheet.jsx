import { useEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import { Avatar } from './ui.jsx';

// Two-way chat. `role` is who is using this screen: 'client' or 'driver'.
export default function ChatSheet({ other, role, messages, quick = [], onSend, onClose }) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const endRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages.length]);

  const send = async (t) => {
    const value = t.trim();
    if (!value || sending) return;
    setSending(true);
    try { await onSend(value); setText(''); } finally { setSending(false); }
  };

  return (
    <div className="sheet-overlay">
      <div className="chat-sheet">
        <header className="chat-head">
          <button className="icon-btn" onClick={onClose} aria-label="Close chat"><Icon name="back" /></button>
          <Avatar name={other.name} src={other.photo} size={40} />
          <div><strong>{other.name}</strong><small>{other.sub}</small></div>
        </header>
        <div className="chat-list">
          {messages.length === 0 && <p className="muted center small">No messages yet. Say hello 👋</p>}
          {messages.map((m, i) => (m.from === 'system' ? (
            <div key={i} className="bubble-system">{m.text}</div>
          ) : (
            <div key={i} className={`bubble ${m.from === role ? 'me' : 'them'}`}>
              {m.text}
              <time>{new Date(m.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</time>
            </div>
          )))}
          <div ref={endRef} />
        </div>
        {quick.length > 0 && (
          <div className="chat-quick">
            {quick.map((q) => <button key={q} className="chip" onClick={() => send(q)}>{q}</button>)}
          </div>
        )}
        <form className="chat-input" onSubmit={(e) => { e.preventDefault(); send(text); }}>
          <input placeholder="Type a message" value={text} onChange={(e) => setText(e.target.value)} maxLength={300} />
          <button className="send-btn" disabled={!text.trim() || sending} aria-label="Send"><Icon name="send" size={18} /></button>
        </form>
      </div>
    </div>
  );
}
