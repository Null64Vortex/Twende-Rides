import { useMemo, useState } from 'react';
import Icon from './Icon.jsx';

export default function PlaceSearch({ title, places, onPick, onClose, exclude, current }) {
  const [q, setQ] = useState('');
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return places.filter((p) => p.id !== exclude
      && (!s || p.name.toLowerCase().includes(s) || p.area.toLowerCase().includes(s)));
  }, [q, places, exclude]);

  return (
    <div className="sheet-overlay">
      <div className="search-sheet">
        <div className="search-head">
          <button className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="back" /></button>
          <div className="search-input">
            <Icon name="search" size={18} />
            <input autoFocus placeholder={title} value={q} onChange={(e) => setQ(e.target.value)} />
            {q && <button className="clear-btn" onClick={() => setQ('')} aria-label="Clear"><Icon name="close" size={16} /></button>}
          </div>
        </div>
        <div className="search-list">
          {current && !q && current.id !== exclude && (
            <button className="place-row current" onClick={() => onPick(current)}>
              <span className="place-ico locate"><Icon name="locate" size={18} /></span>
              <span><strong>Current location</strong><small>{current.name} · {current.area}</small></span>
            </button>
          )}
          {list.map((p) => (
            <button key={p.id} className="place-row" onClick={() => onPick(p)}>
              <span className="place-ico">{p.emoji || <Icon name="pin" size={18} />}</span>
              <span><strong>{p.name}</strong><small>{p.area}</small></span>
            </button>
          ))}
          {list.length === 0 && <div className="empty">No places match “{q}”. Try another area.</div>}
        </div>
      </div>
    </div>
  );
}
