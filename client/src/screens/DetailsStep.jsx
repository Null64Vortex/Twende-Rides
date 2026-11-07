import { useEffect, useState } from 'react';
import Icon from '../components/Icon.jsx';
import PlaceSearch from '../components/PlaceSearch.jsx';
import { Chip, Field, Segmented, StepHeader } from '../components/ui.jsx';
import { localDateTime, validPhone } from '../lib.js';

const AIRPORT_ID = 'ebb';

export default function DetailsStep({ catalog, places, draft, update, next, back }) {
  const isDelivery = draft.service === 'delivery';
  const isAirport = draft.service === 'airport';
  const airport = places.find((p) => p.id === AIRPORT_ID);
  const home = places.find((p) => p.id === 'kasangati');
  const vehicle = catalog.vehicles.find((v) => v.id === draft.vehicle);
  const [picker, setPicker] = useState(null);
  const [tried, setTried] = useState(false);

  // Airport trips always have Entebbe on one side.
  useEffect(() => {
    if (!isAirport) return;
    if (draft.airportDirection === 'to' && draft.dropoff?.id !== AIRPORT_ID) {
      update({ dropoff: airport, pickup: draft.pickup?.id === AIRPORT_ID ? home : draft.pickup });
    }
    if (draft.airportDirection === 'from' && draft.pickup?.id !== AIRPORT_ID) {
      update({ pickup: airport, dropoff: draft.dropoff?.id === AIRPORT_ID ? home : draft.dropoff });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAirport]);

  const setDirection = (dir) => {
    if (dir === draft.airportDirection) return;
    if (dir === 'from') update({ airportDirection: 'from', pickup: airport, dropoff: draft.pickup?.id === AIRPORT_ID ? home : draft.pickup });
    else update({ airportDirection: 'to', dropoff: airport, pickup: draft.dropoff?.id === AIRPORT_ID ? home : draft.dropoff });
  };

  const errors = {};
  if (!draft.pickup) errors.pickup = 'Choose where to pick up';
  if (!draft.dropoff) errors.dropoff = 'Choose where to drop off';
  else if (draft.pickup && draft.pickup.id === draft.dropoff.id) errors.dropoff = 'Drop-off must be different from pickup';
  if (!isDelivery && draft.when === 'later') {
    if (!draft.at || new Date(draft.at).getTime() < Date.now() + 14 * 60000) errors.at = 'Pick a time at least 15 minutes from now';
  }
  if (isDelivery) {
    if (!draft.sender.name.trim()) errors.senderName = 'Enter the sender’s name';
    if (!validPhone(draft.sender.phone)) errors.senderPhone = 'Enter a valid number, e.g. 0772 123456';
    if (!draft.receiver.name.trim()) errors.receiverName = 'Enter the receiver’s name';
    if (!validPhone(draft.receiver.phone)) errors.receiverPhone = 'Enter a valid number, e.g. 0772 123456';
    if (!draft.contents) errors.contents = 'Tell us what’s inside';
  }
  const valid = Object.keys(errors).length === 0;
  const err = (k) => (tried ? errors[k] : undefined);

  const onContinue = () => {
    setTried(true);
    if (valid) next();
  };

  const lockedPickup = isAirport && draft.airportDirection === 'from';
  const lockedDropoff = isAirport && draft.airportDirection === 'to';
  const setPerson = (who, key, value) => update({ [who]: { ...draft[who], [key]: value } });

  return (
    <div className="screen">
      <StepHeader step={4} title={isDelivery ? 'Delivery details' : 'Trip details'}
        subtitle={isDelivery ? 'Who is sending, who is receiving, and what' : 'Where and when'} onBack={back} />
      <div className="screen-body">
        {isAirport && (
          <Segmented value={draft.airportDirection} onChange={setDirection}
            options={[{ id: 'to', label: '🛫 To Entebbe' }, { id: 'from', label: '🛬 From Entebbe' }]} />
        )}

        <div className="route-card">
          <PlaceField kind="pickup" label="Pickup" place={draft.pickup} locked={lockedPickup}
            error={err('pickup')} onClick={() => setPicker('pickup')} />
          <div className="route-divider" />
          <PlaceField kind="dropoff" label="Drop-off" place={draft.dropoff} locked={lockedDropoff}
            error={err('dropoff')} onClick={() => setPicker('dropoff')} />
        </div>

        {isAirport && draft.airportDirection === 'from' && (
          <Field label="Flight number (optional)">
            <input className="input" placeholder="e.g. KQ 414" value={draft.flight}
              onChange={(e) => update({ flight: e.target.value })} maxLength={12} />
          </Field>
        )}

        {!isDelivery && (
          <div className="form-block">
            <span className="block-title">When?</span>
            <Segmented value={draft.when}
              onChange={(w) => update({ when: w, at: w === 'later' && !draft.at ? localDateTime(60) : draft.at })}
              options={[{ id: 'now', label: '⚡ Now' }, { id: 'later', label: '📅 Later' }]} />
            {draft.when === 'later' && (
              <Field label="Date and time" error={err('at')}>
                <input className="input" type="datetime-local" min={localDateTime(15)} value={draft.at}
                  onChange={(e) => update({ at: e.target.value })} />
              </Field>
            )}
          </div>
        )}

        {isDelivery && (
          <>
            <div className="form-block">
              <span className="block-title"><span className="dot dot-pickup" /> Who is sending?</span>
              <div className="two-col">
                <Field label="Name" error={err('senderName')}>
                  <input className="input" placeholder="Sender name" value={draft.sender.name}
                    onChange={(e) => setPerson('sender', 'name', e.target.value)} />
                </Field>
                <Field label="Phone" error={err('senderPhone')}>
                  <input className="input" type="tel" inputMode="tel" placeholder="07XX XXX XXX" value={draft.sender.phone}
                    onChange={(e) => setPerson('sender', 'phone', e.target.value)} />
                </Field>
              </div>
            </div>
            <div className="form-block">
              <span className="block-title"><span className="dot dot-dropoff" /> Who is receiving?</span>
              <div className="two-col">
                <Field label="Name" error={err('receiverName')}>
                  <input className="input" placeholder="Receiver name" value={draft.receiver.name}
                    onChange={(e) => setPerson('receiver', 'name', e.target.value)} />
                </Field>
                <Field label="Phone" error={err('receiverPhone')}>
                  <input className="input" type="tel" inputMode="tel" placeholder="07XX XXX XXX" value={draft.receiver.phone}
                    onChange={(e) => setPerson('receiver', 'phone', e.target.value)} />
                </Field>
              </div>
            </div>
            <div className="form-block">
              <span className="block-title">What is inside?</span>
              <div className="chip-row">
                {catalog.contents.map((c) => (
                  <Chip key={c.id} active={draft.contents === c.id} onClick={() => update({ contents: c.id })}>
                    {c.emoji} {c.name}
                  </Chip>
                ))}
              </div>
              {err('contents') && <span className="field-error">{err('contents')}</span>}
            </div>
            <div className="form-block">
              <span className="block-title">Package size</span>
              <div className="size-grid">
                {catalog.sizes.map((s) => {
                  const allowed = vehicle.sizes.includes(s.id);
                  return (
                    <button key={s.id} type="button" disabled={!allowed}
                      className={`size-card ${draft.size === s.id ? 'active' : ''}`}
                      onClick={() => update({ size: s.id })}>
                      <span className={`size-box size-${s.id}`} />
                      <strong>{s.name}</strong>
                      <small>{allowed ? s.hint : `Not on a ${vehicle.name}`}</small>
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
      <div className="screen-footer">
        <button className="btn btn-primary" onClick={onContinue}>
          Continue <Icon name="arrow" size={18} />
        </button>
      </div>

      {picker && (
        <PlaceSearch
          title={picker === 'pickup' ? 'Search pickup location' : 'Where to?'}
          places={places.filter((p) => !isAirport || p.id !== AIRPORT_ID)}
          current={picker === 'pickup' ? home : null}
          exclude={picker === 'pickup' ? draft.dropoff?.id : draft.pickup?.id}
          onClose={() => setPicker(null)}
          onPick={(p) => { update({ [picker]: p }); setPicker(null); }}
        />
      )}
    </div>
  );
}

function PlaceField({ kind, label, place, locked, error, onClick }) {
  return (
    <button type="button" className={`place-field ${error ? 'has-error' : ''} ${locked ? 'locked' : ''}`}
      onClick={locked ? undefined : onClick} aria-disabled={locked}>
      <span className={`dot dot-${kind}`} />
      <span className="pf-text">
        <small>{label}</small>
        <strong className={place ? '' : 'placeholder'}>{place ? place.name : `Add ${label.toLowerCase()}`}</strong>
        {error ? <em className="field-error">{error}</em> : place && <em>{place.area}</em>}
      </span>
      {locked ? <span className="pf-lock">✈️</span> : <Icon name="search" size={18} className="pf-ico" />}
    </button>
  );
}
