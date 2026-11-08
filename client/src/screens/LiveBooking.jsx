import { useMemo, useState } from 'react';
import { bookingApi, usePoll } from '../api.js';
import ChatSheet from '../components/ChatSheet.jsx';
import Icon, { Star } from '../components/Icon.jsx';
import MapView from '../components/MapView.jsx';
import { Avatar, Modal, Spinner } from '../components/ui.jsx';
import { useLocationSender } from '../geo.js';
import { cap, firstName, fmtDateTime, personWord, telLink } from '../lib.js';

const ACTIVE = ['searching', 'accepted', 'to_pickup', 'arrived', 'in_trip'];
const ORDER = ['accepted', 'to_pickup', 'arrived', 'in_trip', 'done'];
const EMOJI = { boda: '🏍️', car: '🚗', van: '🚐' };

export default function LiveBooking({ session, gpsPos, onFinish, toast }) {
  const bApi = useMemo(() => bookingApi(session), [session]);
  const { data: b, setData, error } = usePoll(() => bApi.get(), 2000, [session.id]);
  const [chatOpen, setChatOpen] = useState(false);
  const [seen, setSeen] = useState(0);
  const [ask, setAsk] = useState(null);
  const [stars, setStars] = useState(0);
  const [busy, setBusy] = useState(false);

  // While the booking is active, keep the driver updated with where the client actually is.
  const sharing = b && ACTIVE.includes(b.status) && b.pickup.gps;
  useLocationSender(sharing ? gpsPos : null, (p) => bApi.location({ lat: p.lat, lng: p.lng }), 5000);

  if (error?.status === 404) {
    return (
      <div className="screen center-screen">
        <h2>Booking not found</h2>
        <p className="muted center">It may have expired after a server restart.</p>
        <button className="btn btn-primary narrow" onClick={onFinish}>Back to home</button>
      </div>
    );
  }
  if (!b) return <div className="screen center-screen"><Spinner /></div>;

  const word = personWord(b.vehicle);
  const Word = cap(word);
  const d = b.driver;
  const isDelivery = b.service === 'delivery';
  const driverMsgs = b.messages.filter((m) => m.from === 'driver').length;
  const unread = chatOpen ? 0 : Math.max(0, driverMsgs - seen);

  const act = async (fn, msg) => {
    setBusy(true);
    try {
      setData(await fn());
      if (msg) toast(msg);
    } catch (e) {
      toast(e.message);
    } finally {
      setBusy(false);
      setAsk(null);
    }
  };
  const cancel = async () => {
    try { await bApi.cancel(); toast('Request cancelled'); onFinish(); } catch (e) { toast(e.message); setAsk(null); }
  };
  const openChat = () => { setChatOpen(true); setSeen(driverMsgs); };
  const closeChat = () => { setChatOpen(false); setSeen(driverMsgs); };
  const lastSystem = [...b.messages].reverse().find((m) => m.from === 'system');

  const chat = chatOpen && d && (
    <ChatSheet role="client" other={{ name: d.name, photo: d.photo, sub: `${d.plate} · ${d.model}` }}
      messages={b.messages} onClose={closeChat}
      quick={['Where are you?', "I'm at the gate", 'Please call me', 'Okay 👍']}
      onSend={(t) => act(() => bApi.message(t))} />
  );

  const cancelModal = ask === 'cancel' && (
    <Modal title="Cancel request?" onClose={() => setAsk(null)}
      actions={<>
        <button className="btn btn-ghost" onClick={() => setAsk(null)}>Keep it</button>
        <button className="btn btn-danger" onClick={cancel}>Yes, cancel</button>
      </>}>
      {d ? `${firstName(d.name)} will be told you cancelled.` : `We'll stop looking for a ${word}.`}
    </Modal>
  );

  /* ---------- Searching ---------- */
  if (b.status === 'searching') {
    return (
      <div className="screen matching">
        <div className="screen-body center-col">
          <div className="radar">
            <span className="ring r1" /><span className="ring r2" /><span className="ring r3" />
            <span className="radar-core">{EMOJI[b.vehicle]}</span>
          </div>
          <h2>Finding the nearest {word}...</h2>
          <p className="muted">We're alerting {word}s close to you. The first one to accept will call you.</p>
          {lastSystem && b.messages.length > 1 && <div className="hint-card">{lastSystem.text}</div>}
          <div className="match-trip">
            <span><span className="dot dot-pickup" /> {b.pickup.name}</span>
            <Icon name="arrow" size={15} />
            <span><span className="dot dot-dropoff" /> {b.dropoff.name}</span>
          </div>
        </div>
        <div className="screen-footer stack">
          <button className="btn btn-ghost" onClick={() => setAsk('cancel')}>Cancel request</button>
        </div>
        {cancelModal}
      </div>
    );
  }

  /* ---------- Nobody available ---------- */
  if (b.status === 'no_drivers') {
    return (
      <div className="screen matching">
        <div className="screen-body center-col">
          <div className="empty-emoji">😔</div>
          <h2>No {word}s available right now</h2>
          <p className="muted">All {word}s near you are busy or offline. Please try again in a minute, or choose a different vehicle.</p>
        </div>
        <div className="screen-footer stack">
          <button className="btn btn-primary" disabled={busy} onClick={() => act(() => bApi.retry())}>Try again</button>
          <button className="btn btn-ghost" onClick={cancel}>Cancel request</button>
        </div>
      </div>
    );
  }

  /* ---------- Driver accepted: agree on price by phone ---------- */
  if (b.status === 'accepted') {
    return (
      <div className="screen matching">
        <div className="screen-body">
          <div className="center-col"><div className="found-badge"><Icon name="check" size={18} stroke={3} /> {Word} found</div></div>
          <DriverCard driver={d} />
          <div className="call-banner">
            <span className="call-banner-ico"><Icon name="phone" size={20} /></span>
            <p><b>{firstName(d.name)}</b> will call you on <b>{b.client.phone}</b> to agree on the price. You can also call them now.</p>
          </div>
          <div className="action-row two">
            <a className="action" href={telLink(d.phone)}><span className="action-ico"><Icon name="phone" size={20} /></span>Call {firstName(d.name)}</a>
            <button className="action" onClick={openChat}>
              <span className="action-ico"><Icon name="chat" size={20} />{unread > 0 && <span className="badge">{unread}</span>}</span>Chat
            </button>
          </div>
        </div>
        <div className="screen-footer stack">
          <button className="btn btn-primary" disabled={busy} onClick={() => setAsk('agree')}>
            <Icon name="check" size={18} stroke={3} /> We agreed on the price
          </button>
          <button className="btn btn-ghost" disabled={busy} onClick={() => setAsk('disagree')}>We couldn't agree. Find another {word}</button>
          <button className="link-btn" onClick={() => setAsk('cancel')}>Cancel request</button>
        </div>
        {ask === 'agree' && (
          <Modal title="Share your location?" onClose={() => setAsk(null)}
            actions={<>
              <button className="btn btn-ghost" onClick={() => setAsk(null)}>Not yet</button>
              <button className="btn btn-primary" onClick={() => act(() => bApi.agree(), `${firstName(d.name)} can now see where you are`)}>Yes, share</button>
            </>}>
            {firstName(d.name)} will see your live location and come to pick you up. Only confirm after you've agreed on the price.
          </Modal>
        )}
        {ask === 'disagree' && (
          <Modal title={`Find another ${word}?`} onClose={() => setAsk(null)}
            actions={<>
              <button className="btn btn-ghost" onClick={() => setAsk(null)}>Go back</button>
              <button className="btn btn-primary" onClick={() => act(() => bApi.notAgreed())}>Find another</button>
            </>}>
            We'll release {firstName(d.name)} and alert the next nearest {word}.
          </Modal>
        )}
        {cancelModal}
        {chat}
      </div>
    );
  }

  /* ---------- Trip in progress / finished ---------- */
  const idx = ORDER.indexOf(b.status);
  const pickupPos = b.clientPos || [b.pickup.lat, b.pickup.lng];
  const pickupMarker = { lat: pickupPos[0], lng: pickupPos[1] };
  const goingToPickup = b.status === 'to_pickup' || b.status === 'arrived';
  const fitPoints = goingToPickup
    ? [d?.position, pickupPos].filter(Boolean)
    : [d?.position, [b.dropoff.lat, b.dropoff.lng], ...(b.tripRoute || [])].filter(Boolean);

  const steps = isDelivery
    ? [{ label: 'Package Picked', active: [1, 2], done: 3 }, { label: 'On the way', active: [3], done: 4 }, { label: 'Delivered', active: [], done: 4 }]
    : [{ label: `${Word} coming`, active: [1], done: 2 }, { label: 'Picked up', active: [2], done: 3 }, { label: 'Arrived', active: [3], done: 4 }];
  const stepState = (s) => (idx >= s.done ? 'done' : s.active.includes(idx) ? 'active' : 'pending');

  let title = '';
  let sub = '';
  if (b.status === 'to_pickup') { title = `${Word} is on the way`; sub = b.etaMin ? `About ${b.etaMin} min away` : 'Coming to your location'; }
  if (b.status === 'arrived') { title = `${Word} has arrived`; sub = isDelivery ? `Hand the package to ${firstName(d.name)}` : `Meet ${firstName(d.name)} at your pickup point`; }
  if (b.status === 'in_trip') { title = isDelivery ? 'On the way' : 'On trip'; sub = `Arriving at ${b.dropoff.name}${b.etaMin ? ` in about ${b.etaMin} min` : ''}`; }

  return (
    <div className="screen trip">
      <div className="trip-map">
        <MapView pickup={pickupMarker} dropoff={b.dropoff} vehicle={b.vehicle} driver={d?.position}
          toPickupRoute={goingToPickup && d?.position ? [d.position, pickupPos] : null}
          tripRoute={b.tripRoute} fitPoints={fitPoints} fitKey={b.status} padTop={80}
          padBottom={b.status === 'done' ? 430 : 380} />
      </div>
      <div className="trip-topbar">
        <span className="trip-code">{isDelivery ? 'Delivery' : 'Trip'} #{b.id}</span>
        {b.schedule?.mode === 'later' && <span className="trip-code light">📅 {fmtDateTime(b.schedule.at)}</span>}
      </div>

      <div className="trip-sheet">
        <span className="sheet-handle" />
        {b.status === 'done' ? (
          <div className="done-panel">
            <div className="done-check"><Icon name="check" size={30} stroke={3} /></div>
            <h2>{isDelivery ? 'Delivered 🎉' : 'You have arrived 🎉'}</h2>
            <p className="muted">{isDelivery ? `${b.delivery.receiver.name} received the package at ${b.dropoff.name}.` : `Welcome to ${b.dropoff.name}.`}</p>
            <div className="pay-summary">
              <span>{b.payment.method === 'cash' ? `Pay ${firstName(d.name)} the price you agreed, in cash.` : `Send ${firstName(d.name)} the agreed amount by Mobile Money (${d.phone}).`}</span>
            </div>
            <p className="rate-label">How was {firstName(d.name)}?</p>
            <div className="stars">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} className={n <= (b.rating || stars) ? 'on' : ''} disabled={!!b.rating}
                  onClick={() => { setStars(n); act(() => bApi.rate(n), 'Thanks for your rating!'); }} aria-label={`${n} stars`}>
                  <Star filled={n <= (b.rating || stars)} />
                </button>
              ))}
            </div>
            <button className="btn btn-primary" onClick={onFinish}>Done</button>
          </div>
        ) : b.status === 'cancelled' ? (
          <div className="done-panel">
            <h2>Request cancelled</h2>
            <button className="btn btn-primary" onClick={onFinish}>Back to home</button>
          </div>
        ) : (
          <>
            <div className="status-head">
              <div><h2>{title}</h2><p className="muted">{sub}</p></div>
              {b.etaMin && <div className="eta-pill"><strong>{b.etaMin}</strong><small>min</small></div>}
            </div>
            <ol className="tracker">
              {steps.map((s) => (
                <li key={s.label} className={stepState(s)}>
                  <span className="tracker-dot">{stepState(s) === 'done' && <Icon name="check" size={12} stroke={3.5} />}</span>
                  <span>{s.label}</span>
                </li>
              ))}
            </ol>
            <div className="driver-row">
              <Avatar name={d.name} src={d.photo} size={52} />
              <div className="driver-info">
                <strong>{d.name}</strong>
                <small>{d.rating ? `★ ${d.rating.toFixed(1)} · ` : ''}{d.color} {d.model}</small>
              </div>
              <span className="plate small">{d.plate}</span>
            </div>
            <div className="action-row">
              <a className="action" href={telLink(d.phone)}><span className="action-ico"><Icon name="phone" size={20} /></span>Call {Word}</a>
              <button className="action" onClick={openChat}>
                <span className="action-ico"><Icon name="chat" size={20} />{unread > 0 && <span className="badge">{unread}</span>}</span>Chat
              </button>
              <button className="action danger" onClick={() => setAsk('cancel')}>
                <span className="action-ico"><Icon name="close" size={20} /></span>Cancel
              </button>
            </div>
          </>
        )}
      </div>
      {cancelModal}
      {chat}
    </div>
  );
}

function DriverCard({ driver: d }) {
  return (
    <div className="driver-card big">
      <Avatar name={d.name} src={d.photo} size={96} />
      <h2>{d.name}</h2>
      <div className="rating">{d.rating ? <>★ {d.rating.toFixed(1)} <span>· {d.ratingCount} rating{d.ratingCount === 1 ? '' : 's'}</span></> : <span>New {personWord(d.vehicle)}</span>}</div>
      <div className="vehicle-line">
        {d.vehiclePhoto
          ? <img className="vehicle-photo" src={d.vehiclePhoto} alt={`${d.model}`} />
          : <span className="vehicle-emoji">{EMOJI[d.vehicle]}</span>}
        <div>
          <strong>{d.model}</strong>
          <small>{d.color || 'Vehicle'}</small>
        </div>
        <div className="plate">{d.plate}</div>
      </div>
    </div>
  );
}
