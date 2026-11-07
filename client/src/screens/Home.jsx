import { useState } from 'react';
import Icon from '../components/Icon.jsx';
import PlaceSearch from '../components/PlaceSearch.jsx';
import { Logo } from '../components/ui.jsx';
import { greeting } from '../lib.js';

const POPULAR = ['ebb', 'acacia', 'ntinda', 'garden-city', 'makerere'];

export default function Home({ catalog, places, draft, onDestination, onQuick }) {
  const [searching, setSearching] = useState(false);
  const popular = POPULAR.map((id) => places.find((p) => p.id === id)).filter(Boolean);

  return (
    <div className="screen home">
      <div className="screen-body no-pad">
        <header className="hero">
          <div className="hero-top">
            <Logo light />
            <button className="hero-avatar" aria-label="Account"><Icon name="user" size={18} /></button>
          </div>
          <p className="hero-greet">{greeting()} 👋</p>
          <h1>Where are you<br />going today?</h1>
          <button className="search-bar" onClick={() => setSearching(true)}>
            <span className="search-bar-ico"><Icon name="search" size={20} /></span>
            <span className="search-bar-text">Where are you going?</span>
            <span className="search-bar-time"><Icon name="clock" size={15} /> Now</span>
          </button>
          <div className="hero-from"><span className="pulse-dot" /> Pickup from <b>{draft.pickup?.name}</b></div>
        </header>

        <section className="quick">
          {catalog.services.map((s) => (
            <button key={s.id} className={`quick-btn quick-${s.id}`} onClick={() => onQuick(s.id)}>
              <span className="quick-emoji">{s.emoji}</span>
              <span className="quick-name">{s.name}</span>
            </button>
          ))}
        </section>

        <section className="home-section">
          <div className="section-head"><h3>Popular places</h3></div>
          <div className="place-list">
            {popular.map((p) => (
              <button key={p.id} className="place-row" onClick={() => onDestination(p)}>
                <span className="place-ico">{p.emoji || <Icon name="pin" size={18} />}</span>
                <span><strong>{p.name}</strong><small>{p.area}</small></span>
                <Icon name="arrow" size={18} className="row-arrow" />
              </button>
            ))}
          </div>
        </section>

        <section className="home-section">
          <button className="promo" onClick={() => onQuick('airport')}>
            <div>
              <span className="promo-tag">VIP Airport</span>
              <strong>Flying out of Entebbe?</strong>
              <p>Your driver meets you inside arrivals with your name on a sign.</p>
            </div>
            <span className="promo-emoji">✈️</span>
          </button>
        </section>

        <section className="home-section trust">
          <div><Icon name="shield" size={18} /> Verified drivers</div>
          <div><Icon name="wallet" size={18} /> Cash or Mobile Money</div>
        </section>
      </div>

      {searching && (
        <PlaceSearch
          title="Where are you going?"
          places={places}
          exclude={draft.pickup?.id}
          onClose={() => setSearching(false)}
          onPick={(p) => { setSearching(false); onDestination(p); }}
        />
      )}
    </div>
  );
}
