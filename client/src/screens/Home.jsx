import { useState } from 'react';
import Icon from '../components/Icon.jsx';
import PlaceSearch from '../components/PlaceSearch.jsx';
import { Logo } from '../components/ui.jsx';
import { greeting } from '../lib.js';

const POPULAR = ['ebb', 'acacia', 'ntinda', 'garden-city', 'makerere'];

export default function Home({ catalog, places, draft, gps, gpsError, nearby, onDestination, onQuick }) {
  const [searching, setSearching] = useState(false);
  const popular = POPULAR.map((id) => places.find((p) => p.id === id)).filter(Boolean);
  const totalNearby = nearby ? nearby.boda + nearby.car + nearby.van : null;

  return (
    <div className="screen home">
      <div className="screen-body no-pad">
        <header className="hero">
          <div className="hero-top">
            <Logo light />
            <a className="hero-driver" href="/driver">Drive with us</a>
          </div>
          <p className="hero-greet">{greeting()} 👋</p>
          <h1>Where are you<br />going today?</h1>
          <button className="search-bar" onClick={() => setSearching(true)}>
            <span className="search-bar-ico"><Icon name="search" size={20} /></span>
            <span className="search-bar-text">Where are you going?</span>
            <span className="search-bar-time"><Icon name="clock" size={15} /> Now</span>
          </button>
          <div className="hero-from">
            {gps ? <><span className="pulse-dot" /> Pickup from your <b>current location</b></>
              : gpsError ? <><span className="pulse-dot off" /> Location is off. You can choose a pickup place.</>
                : <><span className="pulse-dot wait" /> Finding your location...</>}
          </div>
          {totalNearby != null && (
            <div className="hero-nearby">
              {totalNearby > 0
                ? <>🟢 <b>{totalNearby}</b> {totalNearby === 1 ? 'driver' : 'drivers'} online near you</>
                : <>No drivers online near you right now</>}
            </div>
          )}
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
          <div className="how-card">
            <strong>No fixed prices</strong>
            <ol>
              <li><span>1</span>Tell us where you're going.</li>
              <li><span>2</span>The nearest driver accepts. You see their photo and number plate.</li>
              <li><span>3</span>They call you and you agree on the price together.</li>
            </ol>
          </div>
        </section>

        <section className="home-section">
          <a className="promo" href="/driver">
            <div>
              <span className="promo-tag">For drivers</span>
              <strong>Own a boda, car or van?</strong>
              <p>Sign up in 2 minutes, go online, and get requests from clients near you.</p>
            </div>
            <span className="promo-emoji">🏍️</span>
          </a>
        </section>

        <section className="home-section trust">
          <div><Icon name="shield" size={18} /> Driver photo & plate</div>
          <div><Icon name="phone" size={18} /> Price agreed by phone</div>
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
