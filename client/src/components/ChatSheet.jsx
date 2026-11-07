import { useEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import { Avatar } from './ui.jsx';

const QUICK = ['Where are you?', "I'm at the gate", 'Please call me', 'Handle with care'];

export default function ChatSheet({ driver, messages, onSend, onClose, isDelivery }) {
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
          <Avatar name={driver.name} size={40} />
          <div><strong>{driver.name}</strong><small>{driver.plate} · usually replies fast</small></div>
        </header>
        <div className="chat-list">
          {messages.map((m, i) => (
            <div key={i} className={`bubble ${m.from === 'me' ? 'me' : 'them'}`}>
              {m.text}
              <time>{new Date(m.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</time>
            </div>
          ))}
          <div ref={endRef} />
        </div>
        <div className="chat-quick">
          {QUICK.filter((q) => isDelivery || q !== 'Handle with care').map((q) => (
            <button key={q} className="chip" onClick={() => send(q)}>{q}</button>
          ))}
        </div>
        <form className="chat-input" onSubmit={(e) => { e.preventDefault(); send(text); }}>
          <input placeholder="Type a message" value={text} onChange={(e) => setText(e.target.value)} maxLength={300} />
          <button className="send-btn" disabled={!text.trim() || sending} aria-label="Send"><Icon name="send" size={18} /></button>
        </form>
      </div>
    </div>
  );
}
