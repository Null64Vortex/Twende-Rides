import { useState } from 'react';
import { api, useBooking } from '../api.js';
import ChatSheet from '../components/ChatSheet.jsx';
import Icon, { Star } from '../components/Icon.jsx';
import MapView from '../components/MapView.jsx';
import { Avatar, Modal, Spinner } from '../components/ui.jsx';
import { cap, fmtUGX, personWord } from '../lib.js';

const ORDER = ['to_pickup', 'at_pickup', 'in_trip', 'done'];

export default function TripScreen({ bookingId, onHome, toast }) {
  const { booking, setBooking } = useBooking(bookingId);
  const [chatOpen, setChatOpen] = useState(false);
  const [seen, setSeen] = useState(0);
  const [askCancel, setAskCancel] = useState(false);
  const [stars, setStars] = useState(0);

  if (!booking) return <div className="screen center-screen"><Spinner /></div>;
  const b = booking;
  const isDelivery = b.service === 'delivery';
  const word = personWord(b.vehicle);
  const idx = ORDER.indexOf(b.phase);
  const finished = b.phase === 'done' || b.phase === 'cancelled';
  const driverMsgs = b.messages.filter((m) => m.from === 'driver').length;
  const unread = chatOpen ? 0 : Math.max(0, driverMsgs - seen);

  const steps = isDelivery
    ? [{ label: 'Package Picked', at: 1 }, { label: 'On the way', at: 2 }, { label: 'Delivered', at: 3 }]
    : [{ label: `${cap(word)} coming`, at: 0 }, { label: 'On trip', at: 2 }, { label: 'Arrived', at: 3 }];
  const stepState = (at) => (idx > at || b.phase === 'done' ? 'done' : idx === at ? 'active' : 'pending');

  const toPickupPhase = b.phase === 'to_pickup';
  const fitPoints = toPickupPhase ? [...b.routes.toPickup, [b.pickup.lat, b.pickup.lng]] : b.routes.trip;

  let sub = '';
  if (b.phase === 'to_pickup') sub = `Arriving at ${b.pickup.name} in ${b.etaMin} min`;
  if (b.phase === 'at_pickup') sub = isDelivery
    ? `Your ${word} has the package and is leaving ${b.pickup.name}`
    : b.airport?.direction === 'from' && b.tier === 'vip' ? 'Your driver is waiting inside arrivals with your name' : `Meet your ${word} at ${b.pickup.name}`;
  if (b.phase === 'in_trip') sub = `Arriving at ${b.dropoff.name} in ${b.etaMin} min`;

  const openChat = () => { setChatOpen(true); setSeen(driverMsgs); };
  const closeChat = () => { setChatOpen(false); setSeen(driverMsgs); };
  const send = async (text) => {
    try { setBooking(await api.message(b.id, text)); } catch (e) { toast(e.message); }
  };
  const cancel = async () => {
    setAskCancel(false);
    try { await api.cancel(b.id); toast(isDelivery ? 'Delivery cancelled' : 'Trip cancelled'); onHome(); } catch (e) { toast(e.message); }
  };
  const rate = async (n) => {
    setStars(n);
    try { await api.rate(b.id, n); } catch { /* rating is optional */ }
  };

  return (
    <div className="screen trip">
      <div className="trip-map">
        <MapView pickup={b.pickup} dropoff={b.dropoff} vehicle={b.vehicle} driver={b.driverPosition}
          toPickupRoute={toPickupPhase ? b.routes.toPickup : null} tripRoute={b.routes.trip}
          fitPoints={fitPoints} fitKey={toPickupPhase ? 'pickup' : 'trip'} padTop={80} padBottom={finished ? 420 : 360} />
      </div>
      <div className="trip-topbar">
        <button className="icon-btn floating" onClick={onHome} aria-label="Home"><Icon name="back" /></button>
        <span className="trip-code">{isDelivery ? 'Delivery' : 'Trip'} #{b.id}</span>
      </div>

      <div className="trip-sheet">
        <span className="sheet-handle" />
        {b.phase === 'done' ? (
          <div className="done-panel">
            <div className="done-check"><Icon name="check" size={30} stroke={3} /></div>
            <h2>{isDelivery ? 'Delivered 🎉' : 'You have arrived 🎉'}</h2>
            <p className="muted">
              {isDelivery ? `${b.delivery.receiver.name} received the package at ${b.dropoff.name}.` : `Welcome to ${b.dropoff.name}.`}
            </p>
            {isDelivery && b.tier === 'premium' && <div className="proof">📸 Photo of delivery sent to {b.delivery.sender.name}</div>}
            {isDelivery && b.tier === 'vip' && <div className="proof">✍️ Signed by {b.delivery.receiver.name}, handed over door to door</div>}
            <div className="pay-summary">
              <span>{b.payment.method === 'cash' ? `Pay your ${word} in cash` : 'Paid with Mobile Money'}</span>
              <strong>{fmtUGX(b.quote.price)}</strong>
            </div>
            <p className="rate-label">How was {b.driver.name.split(' ')[0]}?</p>
            <div className="stars">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} className={n <= stars ? 'on' : ''} onClick={() => rate(n)} aria-label={`${n} stars`}>
                  <Star filled={n <= stars} />
                </button>
              ))}
            </div>
            <button className="btn btn-primary" onClick={() => { if (stars) toast('Thanks for your rating!'); onHome(); }}>Done</button>
          </div>
        ) : b.phase === 'cancelled' ? (
          <div className="done-panel">
            <h2>{b.statusLabel}</h2>
            <button className="btn btn-primary" onClick={onHome}>Back to home</button>
          </div>
        ) : (
          <>
            <div className="status-head">
              <div>
                <h2>{b.statusLabel}</h2>
                <p className="muted">{sub}</p>
              </div>
              {b.etaMin && <div className="eta-pill"><strong>{b.etaMin}</strong><small>min</small></div>}
            </div>

            <ol className="tracker">
              {steps.map((s) => (
                <li key={s.label} className={stepState(s.at)}>
                  <span className="tracker-dot">{stepState(s.at) === 'done' && <Icon name="check" size={12} stroke={3.5} />}</span>
                  <span>{s.label}</span>
                </li>
              ))}
            </ol>

            <div className="driver-row">
              <Avatar name={b.driver.name} size={52} />
              <div className="driver-info">
                <strong>{b.driver.name}</strong>
                <small>★ {b.driver.rating.toFixed(1)} · {b.driver.color} {b.driver.model}</small>
              </div>
              <span className="plate small">{b.driver.plate}</span>
            </div>

            <div className="action-row">
              <a className="action" href={`tel:${b.driver.phone.replace(/\s/g, '')}`}>
                <span className="action-ico"><Icon name="phone" size={20} /></span>Call {cap(word)}
              </a>
              <button className="action" onClick={openChat}>
                <span className="action-ico"><Icon name="chat" size={20} />{unread > 0 && <span className="badge">{unread}</span>}</span>Chat
              </button>
              <button className="action danger" onClick={() => setAskCancel(true)}>
                <span className="action-ico"><Icon name="close" size={20} /></span>Cancel
              </button>
            </div>
          </>
        )}
      </div>

      {chatOpen && (
        <ChatSheet driver={b.driver} messages={b.messages} onSend={send} onClose={closeChat} isDelivery={isDelivery} />
      )}

      {askCancel && (
        <Modal title={isDelivery ? 'Cancel delivery?' : 'Cancel trip?'} onClose={() => setAskCancel(false)}
          actions={<>
            <button className="btn btn-ghost" onClick={() => setAskCancel(false)}>Keep it</button>
            <button className="btn btn-danger" onClick={cancel}>Yes, cancel</button>
          </>}>
          {b.driver.name.split(' ')[0]} is already on the way. Are you sure?
        </Modal>
      )}
    </div>
  );
}
