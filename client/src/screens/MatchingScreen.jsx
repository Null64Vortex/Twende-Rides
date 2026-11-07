import { useEffect, useState } from 'react';
import { api, useBooking } from '../api.js';
import Icon from '../components/Icon.jsx';
import { Avatar, Modal, Spinner } from '../components/ui.jsx';
import { cap, fmtDateTime, personWord } from '../lib.js';

const EMOJI = { boda: '🏍️', car: '🚗', van: '🚐' };
const LIVE = ['to_pickup', 'at_pickup', 'in_trip', 'done'];

export default function MatchingScreen({ bookingId, onTrack, onHome, toast }) {
  const { booking } = useBooking(bookingId);
  const [askCancel, setAskCancel] = useState(false);
  const phase = booking?.phase;

  useEffect(() => {
    if (!LIVE.includes(phase)) return undefined;
    const t = setTimeout(onTrack, 3200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  if (!booking) return <div className="screen center-screen"><Spinner /></div>;
  const word = personWord(booking.vehicle);

  const cancel = async () => {
    try { await api.cancel(booking.id); toast('Booking cancelled'); onHome(); } catch (e) { toast(e.message); }
  };
  const startNow = async () => {
    try { await api.start(booking.id); onTrack(); } catch (e) { toast(e.message); }
  };

  return (
    <div className="screen matching">
      <div className="screen-body center-col">
        {phase === 'searching' ? (
          <>
            <div className="radar">
              <span className="ring r1" /><span className="ring r2" /><span className="ring r3" />
              <span className="radar-core">{EMOJI[booking.vehicle]}</span>
            </div>
            <h2>Finding your {word}...</h2>
            <p className="muted">Matching you with the closest {word}s near {booking.pickup.name}</p>
            <div className="match-trip">
              <span><span className="dot dot-pickup" /> {booking.pickup.name}</span>
              <Icon name="arrow" size={15} />
              <span><span className="dot dot-dropoff" /> {booking.dropoff.name}</span>
            </div>
          </>
        ) : booking.driver ? (
          <>
            <div className="found-badge"><Icon name="check" size={18} stroke={3} /> {cap(word)} found</div>
            <div className="driver-card big">
              <Avatar name={booking.driver.name} size={84} />
              <h2>{booking.driver.name}</h2>
              <div className="rating">★ {booking.driver.rating.toFixed(1)} <span>· {booking.driver.trips.toLocaleString()} trips</span></div>
              <div className="plate">{booking.driver.plate}</div>
              <p className="muted">{booking.driver.color} {booking.driver.model}</p>
              {phase === 'scheduled' ? (
                <p className="eta-line">Booked for <b>{fmtDateTime(booking.schedule.at)}</b></p>
              ) : booking.etaMin ? (
                <p className="eta-line">Arriving in <b>{booking.etaMin} min</b></p>
              ) : null}
            </div>
          </>
        ) : null}
      </div>
      <div className="screen-footer stack">
        {phase === 'searching' && <button className="btn btn-ghost" onClick={() => setAskCancel(true)}>Cancel</button>}
        {phase === 'scheduled' && (
          <>
            <button className="btn btn-primary" onClick={startNow}>Start trip now <small>(demo)</small></button>
            <button className="btn btn-ghost" onClick={onHome}>Back to home</button>
          </>
        )}
        {LIVE.includes(phase) && (
          <button className="btn btn-primary" onClick={onTrack}>Track your {word} <Icon name="arrow" size={18} /></button>
        )}
      </div>

      {askCancel && (
        <Modal title="Cancel booking?" onClose={() => setAskCancel(false)}
          actions={<>
            <button className="btn btn-ghost" onClick={() => setAskCancel(false)}>Keep looking</button>
            <button className="btn btn-danger" onClick={cancel}>Yes, cancel</button>
          </>}>
          We're almost done finding you a {word}.
        </Modal>
      )}
    </div>
  );
}
