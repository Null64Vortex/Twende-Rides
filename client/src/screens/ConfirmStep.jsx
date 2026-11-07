import { useEffect, useState } from 'react';
import { api, bookingRequest, coreRequest } from '../api.js';
import Icon from '../components/Icon.jsx';
import MapView from '../components/MapView.jsx';
import { Field, StepHeader, Spinner } from '../components/ui.jsx';
import { fmtDateTime, fmtUGX, validPhone } from '../lib.js';

export default function ConfirmStep({ catalog, draft, update, back, onBooked }) {
  const [quote, setQuote] = useState(null);
  const [route, setRoute] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [tried, setTried] = useState(false);

  const service = catalog.services.find((s) => s.id === draft.service);
  const vehicle = catalog.vehicles.find((v) => v.id === draft.vehicle);
  const tier = catalog.tiers.find((t) => t.id === draft.tier);
  const size = catalog.sizes.find((s) => s.id === draft.size);
  const contents = catalog.contents.find((c) => c.id === draft.contents);
  const isDelivery = draft.service === 'delivery';

  useEffect(() => {
    api.quote(coreRequest(draft)).then(setQuote).catch((e) => setError(e.message));
    api.route(draft.pickup.id, draft.dropoff.id).then((r) => setRoute(r.points)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const momoError = draft.payment === 'momo' && !validPhone(draft.momoPhone) ? 'Enter your MTN or Airtel number' : null;

  async function confirm() {
    setTried(true);
    if (momoError || !quote) return;
    setBusy(true);
    setError(null);
    try {
      const booking = await api.book(bookingRequest(draft));
      onBooked(booking.id);
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  return (
    <div className="screen">
      <StepHeader step={5} title="Confirm booking" subtitle="Check everything looks right" onBack={back} />
      <div className="screen-body">
        <div className="confirm-map">
          <MapView pickup={draft.pickup} dropoff={draft.dropoff} tripRoute={route} fitPoints={route}
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
            {isDelivery && (
              <>
                <div><dt>Sender</dt><dd>{draft.sender.name} · {draft.sender.phone}</dd></div>
                <div><dt>Receiver</dt><dd>{draft.receiver.name} · {draft.receiver.phone}</dd></div>
              </>
            )}
            {draft.service === 'airport' && draft.flight && <div><dt>Flight</dt><dd>{draft.flight.toUpperCase()}</dd></div>}
            <div><dt>Distance</dt><dd>{quote ? `${quote.distanceKm} km · about ${quote.durationMin} min` : '…'}</dd></div>
          </dl>

          <div className="price-row">
            <span>Total</span>
            <strong>{quote ? fmtUGX(quote.price) : <Spinner />}</strong>
          </div>
        </div>

        <div className="form-block">
          <span className="block-title">Pay with</span>
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
          {draft.payment === 'momo' && (
            <Field label="Mobile Money number" error={tried ? momoError : null}>
              <input className="input" type="tel" inputMode="tel" placeholder="07XX XXX XXX" value={draft.momoPhone}
                onChange={(e) => update({ momoPhone: e.target.value })} />
            </Field>
          )}
        </div>

        {error && <div className="alert">{error}</div>}
      </div>
      <div className="screen-footer">
        <button className="btn btn-primary" onClick={confirm} disabled={busy || !quote}>
          {busy ? <Spinner /> : <>Confirm Booking{quote && <span className="btn-sub">{fmtUGX(quote.price)}</span>}</>}
        </button>
      </div>
    </div>
  );
}
