import { useEffect, useState } from 'react';
import { api, bookingRequest } from '../api.js';
import Icon from '../components/Icon.jsx';
import MapView from '../components/MapView.jsx';
import { StepHeader, Spinner } from '../components/ui.jsx';
import { fmtDateTime, personWord } from '../lib.js';

export default function ConfirmStep({ catalog, draft, update, back, onBooked }) {
  const [route, setRoute] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const service = catalog.services.find((s) => s.id === draft.service);
  const vehicle = catalog.vehicles.find((v) => v.id === draft.vehicle);
  const tier = catalog.tiers.find((t) => t.id === draft.tier);
  const size = catalog.sizes.find((s) => s.id === draft.size);
  const contents = catalog.contents.find((c) => c.id === draft.contents);
  const isDelivery = draft.service === 'delivery';
  const word = personWord(draft.vehicle);
  const contact = isDelivery ? draft.sender : draft.me;

  useEffect(() => {
    api.route(draft.pickup, draft.dropoff).then(setRoute).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function request() {
    setBusy(true);
    setError(null);
    try {
      const { token, booking } = await api.book(bookingRequest(draft));
      onBooked({ id: booking.id, token });
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  return (
    <div className="screen">
      <StepHeader step={5} title="Confirm request" subtitle="Check everything looks right" onBack={back} />
      <div className="screen-body">
        <div className="confirm-map">
          <MapView pickup={draft.pickup} dropoff={draft.dropoff} tripRoute={route?.points} fitPoints={route?.points}
            fitKey={route ? 'r' : 'p'} interactive={false} padTop={28} padBottom={28} />
        </div>

        <div className="summary-card">
          <div className="summary-head">
            <span className="summary-emoji">{service.emoji}</span>
            <div>
              <strong>{service.name} · {vehicle.name} · {tier.name}</strong>
              <small>{isDelivery ? `${size.name} package · ${contents?.emoji} ${contents?.name}` : draft.when === 'now' ? 'Pickup now' : fmtDateTime(draft.at)}</small>
            </div>
          </div>

          <div className="summary-route">
            <div><span className="dot dot-pickup" /><span>{draft.pickup.name}</span></div>
            <Icon name="arrow" size={16} />
            <div><span className="dot dot-dropoff" /><span>{draft.dropoff.name}</span></div>
          </div>

          <dl className="summary-rows">
            <div><dt>{isDelivery ? 'Sender' : 'Your phone'}</dt><dd>{isDelivery ? `${contact.name} · ` : ''}{contact.phone}</dd></div>
            {isDelivery && <div><dt>Receiver</dt><dd>{draft.receiver.name} · {draft.receiver.phone}</dd></div>}
            {draft.service === 'airport' && draft.flight && <div><dt>Flight</dt><dd>{draft.flight.toUpperCase()}</dd></div>}
            {route && <div><dt>Distance</dt><dd>about {Math.round(route.km)} km</dd></div>}
          </dl>
        </div>

        <div className="how-card">
          <strong>How it works</strong>
          <ol>
            <li><span>1</span>We alert the nearest available {word}.</li>
            <li><span>2</span>You see their photo, vehicle and number plate.</li>
            <li><span>3</span>They <b>call you</b> and you agree on the price together.</li>
            <li><span>4</span>Only then is your location shared so they can come to you.</li>
          </ol>
        </div>

        <div className="form-block">
          <span className="block-title">I'll pay with</span>
          <div className="pay-list">
            {catalog.payments.map((p) => (
              <button key={p.id} type="button" className={`pay-option ${draft.payment === p.id ? 'active' : ''}`}
                onClick={() => update({ payment: p.id })}>
                <span className="pay-emoji">{p.emoji}</span>
                <span className="pay-text"><strong>{p.name}</strong><small>{p.hint}</small></span>
                <span className="radio" />
              </button>
            ))}
          </div>
        </div>

        {error && <div className="alert">{error}</div>}
      </div>
      <div className="screen-footer">
        <button className="btn btn-primary" onClick={request} disabled={busy}>
          {busy ? <Spinner /> : <>Request {word} <Icon name="arrow" size={18} /></>}
        </button>
      </div>
    </div>
  );
}
