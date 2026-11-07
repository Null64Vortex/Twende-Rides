import { useEffect, useState } from 'react';
import { api, coreRequest } from '../api.js';
import { OptionCard, StepHeader } from '../components/ui.jsx';
import { fmtUGX, tierInfo } from '../lib.js';

const ADVANCE_DELAY = 170;

export function ServiceStep({ catalog, draft, update, next, back }) {
  const pick = (id) => { update({ service: id }); setTimeout(next, ADVANCE_DELAY); };
  return (
    <div className="screen">
      <StepHeader step={1} title="What do you need?" subtitle="Pick a service to get started" onBack={back} />
      <div className="screen-body">
        <div className="option-list">
          {catalog.services.map((s) => (
            <OptionCard key={s.id} emoji={s.emoji} title={s.title} desc={s.tagline}
              selected={draft.service === s.id} onClick={() => pick(s.id)} />
          ))}
        </div>
        {draft.dropoff && (
          <div className="hint-card">📍 Heading to <b>{draft.dropoff.name}</b></div>
        )}
      </div>
    </div>
  );
}

export function VehicleStep({ catalog, draft, update, next, back }) {
  const isDelivery = draft.service === 'delivery';
  const pick = (v) => {
    const size = v.sizes.includes(draft.size) ? draft.size : v.sizes[0];
    update({ vehicle: v.id, size });
    setTimeout(next, ADVANCE_DELAY);
  };
  return (
    <div className="screen">
      <StepHeader step={2}
        title={isDelivery ? 'How big is the package?' : 'Choose your vehicle'}
        subtitle={isDelivery ? 'Pick a vehicle that fits your package' : 'Pick how you want to travel'}
        onBack={back} />
      <div className="screen-body">
        <div className="option-list">
          {catalog.vehicles.map((v) => (
            <OptionCard key={v.id} emoji={v.emoji} title={v.name} desc={v.desc[draft.service]}
              selected={draft.vehicle === v.id} onClick={() => pick(v)}
              right={<span className="pill">{isDelivery ? sizeLabel(v.sizes) : v.seats.replace(' passengers', '').replace(' passenger', '')}</span>} />
          ))}
        </div>
      </div>
    </div>
  );
}

function sizeLabel(sizes) {
  return sizes.length === 1 ? 'Small' : sizes.length === 2 ? 'Up to medium' : 'Any size';
}

export function ClassStep({ catalog, draft, update, next, back }) {
  const isDelivery = draft.service === 'delivery';
  const [prices, setPrices] = useState({});

  useEffect(() => {
    if (!draft.pickup || !draft.dropoff || draft.pickup.id === draft.dropoff.id) return;
    let alive = true;
    Promise.all(catalog.tiers.map((t) => api.quote(coreRequest({ ...draft, tier: t.id })).then((q) => [t.id, q.price])))
      .then((pairs) => alive && setPrices(Object.fromEntries(pairs)))
      .catch(() => {});
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pick = (id) => { update({ tier: id }); setTimeout(next, ADVANCE_DELAY); };
  return (
    <div className="screen">
      <StepHeader step={3} title="Choose a class"
        subtitle={isDelivery ? 'How should we handle your package?' : 'How comfortable do you want it?'} onBack={back} />
      <div className="screen-body">
        <div className="option-list">
          {catalog.tiers.map((t) => {
            const info = tierInfo(t, draft.service, draft.vehicle);
            return (
              <OptionCard key={t.id} emoji={TIER_EMOJI[t.id]} title={t.name} desc={info.summary}
                selected={draft.tier === t.id} onClick={() => pick(t.id)}
                right={prices[t.id] ? <span className="price-tag">{fmtUGX(prices[t.id])}</span> : null}>
                <span className="perks">{info.perks.map((p) => <span key={p}>{p}</span>)}</span>
              </OptionCard>
            );
          })}
        </div>
        {!draft.dropoff && <p className="muted small center">You'll see the exact price after adding your drop-off.</p>}
      </div>
    </div>
  );
}

const TIER_EMOJI = { basic: '🟢', standard: '❄️', premium: '⭐', vip: '👑' };
