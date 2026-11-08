import { OptionCard, StepHeader } from '../components/ui.jsx';
import { tierInfo } from '../lib.js';

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

export function VehicleStep({ catalog, draft, update, next, back, nearby }) {
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
          {catalog.vehicles.map((v) => {
            const count = nearby?.[v.id];
            return (
              <OptionCard key={v.id} emoji={v.emoji} title={v.name} desc={v.desc[draft.service]}
                selected={draft.vehicle === v.id} onClick={() => pick(v)}
                right={count == null ? null : (
                  <span className={`pill ${count ? 'pill-live' : ''}`}>{count ? `${count} nearby` : 'None nearby'}</span>
                )} />
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function ClassStep({ catalog, draft, update, next, back }) {
  const isDelivery = draft.service === 'delivery';
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
                selected={draft.tier === t.id} onClick={() => pick(t.id)}>
                <span className="perks">{info.perks.map((p) => <span key={p}>{p}</span>)}</span>
              </OptionCard>
            );
          })}
        </div>
        <p className="muted small center">No fixed prices. You agree on the price with your driver by phone.</p>
      </div>
    </div>
  );
}

const TIER_EMOJI = { basic: '🟢', standard: '❄️', premium: '⭐', vip: '👑' };
