import { useEffect, useMemo, useRef, useState } from 'react';
import { driverApi, usePoll } from '../api.js';
import ChatSheet from '../components/ChatSheet.jsx';
import Icon from '../components/Icon.jsx';
import MapView from '../components/MapView.jsx';
import { Avatar, Modal, Spinner } from '../components/ui.jsx';
import { keepAwake, mapsLink, ring, unlockAudio, useGeolocation, useLocationSender } from '../geo.js';
import { cap, firstName, fmtDateTime, telLink } from '../lib.js';

const VEHICLE_EMOJI = { boda: '🏍️', car: '🚗', van: '🚐' };
const JOB_STEPS = [
  { key: 'accepted', label: 'Agree price' },
  { key: 'to_pickup', label: 'Pickup' },
  { key: 'arrived', label: 'Arrived' },
  { key: 'in_trip', label: 'On trip' },
];

function fmtDuration(ms) {
  const m = Math.floor(ms / 60000);
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`;
}

export default function DriverDashboard({ catalog, session, profile, onSession, onEdit, onSignOut, toast }) {
  const dApi = useMemo(() => driverApi(session), [session]);
  const { data: state, setData, error } = usePoll(() => dApi.me(), 2000, [session.id, session.token]);
  const geo = useGeolocation(true);
  const online = !!state?.driver.online;
  const job = state?.job || null;
  const offer = state?.offer || null;
  const [tab, setTab] = useState('home');
  const [busy, setBusy] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [seen, setSeen] = useState(0);
  const [ask, setAsk] = useState(null);

  useLocationSender(online ? geo.pos : null, (p) => dApi.location(p), 4000);

  // The server forgot us (e.g. it restarted): sign in again with the saved profile.
  useEffect(() => {
    if (error?.status !== 401) return;
    dApi.register(profile).then((r) => onSession({ id: r.id, token: r.token })).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error?.status]);

  // Ring and vibrate until the driver answers a new request.
  useEffect(() => {
    if (!offer?.id) return undefined;
    ring();
    const t = setInterval(ring, 3000);
    return () => clearInterval(t);
  }, [offer?.id]);

  // Keep the screen on while online.
  useEffect(() => {
    if (!online) return undefined;
    let lock = null;
    keepAwake().then((l) => { lock = l; });
    return () => { lock?.release?.(); };
  }, [online]);

  // A job appears: jump to the home tab. A job disappears without us ending it: the client cancelled.
  const prevJob = useRef(null);
  const ending = useRef(false);
  useEffect(() => {
    const prev = prevJob.current;
    if (job) setTab('home');
    if (prev && !job && !ending.current) toast(`${firstName(prev.client.name)} cancelled the request`);
    ending.current = false;
    prevJob.current = job;
    if (!job) { setChatOpen(false); setSeen(0); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.id]);

  const act = async (fn, msg, endsJob = false) => {
    setBusy(true);
    try {
      if (endsJob) ending.current = true;
      setData(await fn());
      if (msg) toast(msg);
    } catch (e) {
      ending.current = false;
      toast(e.message);
    } finally {
      setBusy(false);
      setAsk(null);
    }
  };

  const toggleOnline = async () => {
    if (online) { act(() => dApi.status(false), "You're offline"); return; }
    unlockAudio();
    if (!geo.pos) { toast(geo.error || 'Waiting for your GPS signal...'); return; }
    await dApi.location(geo.pos).catch(() => {});
    act(() => dApi.status(true), "You're online. Requests will ring here");
  };

  if (!state) {
    return (
      <div className="screen center-screen">
        {error && error.status !== 401 ? <p className="muted center">{error.message}</p> : <Spinner />}
      </div>
    );
  }

  const me = state.driver;
  const stats = state.stats;
  const myPos = geo.pos ? [geo.pos.lat, geo.pos.lng] : me.position;
  const svc = (id) => catalog.services.find((s) => s.id === id);
  const tierName = (id) => catalog.tiers.find((t) => t.id === id)?.name;
  const clientMsgs = job ? job.messages.filter((m) => m.from === 'client').length : 0;
  const unread = chatOpen ? 0 : Math.max(0, clientMsgs - seen);
  const openChat = () => { setChatOpen(true); setSeen(clientMsgs); };

  return (
    <div className="screen drv-dash">
      <header className="drv-bar">
        <Avatar name={me.name} src={me.photo} size={44} />
        <div className="drv-bar-text">
          <strong>{me.name}</strong>
          <small>{VEHICLE_EMOJI[me.vehicle]} {me.model} · <span className="mono">{me.plate}</span></small>
        </div>
        <button className={`drv-switch ${online ? 'on' : ''}`} onClick={toggleOnline} disabled={busy || (!!job && online)}
          aria-label={online ? 'Go offline' : 'Go online'}>
          <span className="drv-switch-knob" />
          <span className="drv-switch-label">{online ? 'Online' : 'Offline'}</span>
        </button>
      </header>

      <div className="drv-body">
        {tab === 'home' && (job
          ? <JobPanel job={job} me={me} myPos={myPos} svc={svc(job.service)} tierName={tierName(job.tier)}
              busy={busy} unread={unread} onChat={openChat} onAsk={setAsk}
              onAdvance={(a, msg, ends) => act(() => dApi.advance(a), msg, ends)} />
          : <IdlePanel me={me} stats={stats} online={online} geo={geo} myPos={myPos} busy={busy} onToggle={toggleOnline} />)}
        {tab === 'trips' && <TripsPanel stats={stats} me={me} catalog={catalog} />}
        {tab === 'profile' && <ProfilePanel me={me} stats={stats} onEdit={onEdit} onSignOut={() => setAsk('signout')} online={online} />}
      </div>

      <nav className="drv-nav">
        {[['home', 'home', job ? 'Current trip' : 'Home'], ['trips', 'list', 'Trips'], ['profile', 'user', 'Profile']].map(([id, icon, label]) => (
          <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>
            <Icon name={icon} size={21} />
            <span>{label}</span>
            {id === 'home' && job && tab !== 'home' && <span className="drv-nav-dot" />}
          </button>
        ))}
      </nav>

      {offer && <OfferAlert key={offer.id} offer={offer} svc={svc(offer.service)} tierName={tierName(offer.tier)} busy={busy}
        onAnswer={(yes) => act(() => dApi.respond(offer.id, yes), yes ? `Accepted. Call ${offer.client.name} now.` : 'Request declined')} />}

      {ask === 'agree' && job && (
        <Modal title="Price agreed?" onClose={() => setAsk(null)}
          actions={<>
            <button className="btn btn-ghost" onClick={() => setAsk(null)}>Not yet</button>
            <button className="btn btn-primary" onClick={() => act(() => dApi.advance('agree'), `Head to ${firstName(job.client.name)} now`)}>Yes, we agreed</button>
          </>}>
          Confirm only after you and {firstName(job.client.name)} agreed on the price by phone. You'll then see their location.
        </Modal>
      )}
      {ask === 'release' && job && (
        <Modal title="Release this request?" onClose={() => setAsk(null)}
          actions={<>
            <button className="btn btn-ghost" onClick={() => setAsk(null)}>Go back</button>
            <button className="btn btn-danger" onClick={() => act(() => dApi.advance('release'), 'Request released', true)}>Release</button>
          </>}>
          {job.status === 'accepted'
            ? `Use this only if ${firstName(job.client.name)} doesn't answer your calls. If you can't agree on a price, the client cancels.`
            : `We'll find ${firstName(job.client.name)} another driver. Releasing trips often lowers your rating.`}
        </Modal>
      )}
      {ask === 'signout' && (
        <Modal title="Sign out?" onClose={() => setAsk(null)}
          actions={<>
            <button className="btn btn-ghost" onClick={() => setAsk(null)}>Stay</button>
            <button className="btn btn-danger" disabled={!!job} onClick={async () => {
              await dApi.status(false).catch(() => {});
              onSignOut();
            }}>Sign out</button>
          </>}>
          {job ? 'Finish your current trip first.' : 'You will go offline and need to sign up again on this phone.'}
        </Modal>
      )}

      {chatOpen && job && (
        <ChatSheet role="driver" other={{ name: job.client.name, sub: job.client.phone }} messages={job.messages}
          quick={["I'm on my way", "I've arrived", 'Where exactly are you?', 'Okay 👍']}
          onClose={() => { setChatOpen(false); setSeen(clientMsgs); }}
          onSend={(t) => act(() => dApi.message(t))} />
      )}
    </div>
  );
}

/* ---------------- Home (no job) ---------------- */
function IdlePanel({ me, stats, online, geo, myPos, busy, onToggle }) {
  return (
    <>
      <section className={`drv-status ${online ? 'on' : ''}`}>
        <div className="drv-status-top">
          <div>
            <span className="drv-eyebrow">{online ? 'Status' : 'You are'}</span>
            <h2>{online ? 'Looking for requests' : 'Offline'}</h2>
            <p>{online
              ? 'Keep this screen open. New requests ring and vibrate.'
              : 'Go online to start receiving requests near you.'}</p>
          </div>
          <button className={`drv-go ${online ? 'on' : ''}`} onClick={onToggle} disabled={busy}>
            {online ? <span className="drv-radar" /> : null}
            <Icon name="power" size={30} stroke={2.4} />
            <small>{online ? 'STOP' : 'GO'}</small>
          </button>
        </div>
        <div className="drv-status-meta">
          <span className={geo.pos ? 'ok' : 'warn'}><Icon name="gps" size={15} />
            {geo.pos ? `GPS ±${Math.max(3, Math.round(geo.pos.accuracy))} m` : geo.error ? 'GPS blocked' : 'Finding GPS...'}</span>
          {online && <span><Icon name="clock" size={15} /> Online {fmtDuration(me.onlineForMs)}</span>}
        </div>
        {geo.error && <p className="drv-error">{geo.error}</p>}
      </section>

      <section className="drv-stats">
        <div><small>Trips today</small><strong>{stats.tripsToday}</strong></div>
        <div><small>Rating</small><strong>{me.rating ? <>{me.rating.toFixed(1)}<em>★</em></> : '—'}</strong></div>
        <div><small>All trips</small><strong>{stats.tripsTotal}</strong></div>
      </section>

      <section className="drv-map-card">
        <div className="drv-card-head"><strong>Your location</strong><span>{online ? 'Visible to dispatch' : 'Hidden while offline'}</span></div>
        <div className="drv-map">
          <MapView vehicle={me.vehicle} driver={myPos} fitPoints={[myPos].filter(Boolean)} fitKey={myPos ? 'y' : 'n'} padTop={20} padBottom={20} />
        </div>
      </section>

      <section className="drv-tips">
        <div><span>🔋</span><p><b>Stay charged.</b> GPS and the screen use battery while online.</p></div>
        <div><span>📞</span><p><b>Call fast.</b> After accepting, call the client and agree on the price.</p></div>
        <div><span>🛡️</span><p><b>Be on time.</b> Good ratings bring you more requests.</p></div>
      </section>
    </>
  );
}

/* ---------------- Active job ---------------- */
function JobPanel({ job, me, myPos, svc, tierName, busy, unread, onChat, onAsk, onAdvance }) {
  const isDelivery = job.service === 'delivery';
  const name = firstName(job.client.name);
  const toDropoff = job.status === 'in_trip';
  const stepIdx = JOB_STEPS.findIndex((s) => s.key === job.status);
  const clientPin = job.clientPos ? { lat: job.clientPos[0], lng: job.clientPos[1] } : null;
  const fitPoints = !job.revealed
    ? [myPos].filter(Boolean)
    : toDropoff ? [myPos, [job.dropoff.lat, job.dropoff.lng], ...(job.tripRoute || [])].filter(Boolean) : [myPos, job.clientPos].filter(Boolean);
  const navTarget = toDropoff ? [job.dropoff.lat, job.dropoff.lng] : job.clientPos;

  let title = '';
  let sub = '';
  if (job.status === 'accepted') { title = `Call ${name} to agree on the price`; sub = `Client is ${job.pickupKm ?? '?'} km from you. Location unlocks after you confirm.`; }
  if (job.status === 'to_pickup') { title = `Pick up ${name}`; sub = `${job.pickupKm} km away${job.etaMin ? ` · about ${job.etaMin} min` : ''}`; }
  if (job.status === 'arrived') { title = isDelivery ? 'Collect the package' : `Waiting for ${name}`; sub = isDelivery ? 'Check the package, then tap Package picked.' : `Let ${name} know you're here.`; }
  if (job.status === 'in_trip') { title = isDelivery ? `Deliver to ${job.receiver?.name || job.dropoff.name}` : `Drive to ${job.dropoff.name}`; sub = job.etaMin ? `About ${job.etaMin} min left` : ''; }

  return (
    <>
      <ol className="drv-steps">
        {JOB_STEPS.map((s, i) => (
          <li key={s.key} className={i < stepIdx ? 'done' : i === stepIdx ? 'active' : ''}>
            <span>{i < stepIdx ? <Icon name="check" size={12} stroke={3.5} /> : i + 1}</span>{s.label}
          </li>
        ))}
      </ol>

      <section className="drv-job-head">
        <span className="drv-eyebrow">{svc.emoji} {svc.title} · {tierName}</span>
        <h2>{title}</h2>
        {sub && <p>{sub}</p>}
      </section>

      <section className="drv-map-card tall">
        <div className="drv-map">
          <MapView vehicle={me.vehicle} driver={myPos} pickup={clientPin} dropoff={job.revealed ? job.dropoff : null}
            toPickupRoute={job.revealed && !toDropoff && myPos && job.clientPos ? [myPos, job.clientPos] : null}
            tripRoute={toDropoff ? job.tripRoute : null}
            fitPoints={fitPoints} fitKey={`${job.status}-${myPos ? 1 : 0}`} padTop={30} padBottom={30} />
          {!job.revealed && (
            <div className="drv-map-lock"><span>🔒</span><p>Client location appears after you confirm the price</p></div>
          )}
        </div>
        {job.revealed && navTarget && (
          <a className="drv-nav-btn" href={mapsLink(navTarget[0], navTarget[1])} target="_blank" rel="noreferrer">
            <Icon name="route" size={18} /> Navigate with Google Maps
          </a>
        )}
      </section>

      <section className="drv-client">
        <Avatar name={job.client.name} size={46} />
        <div>
          <small>{isDelivery ? 'Sender' : 'Client'}</small>
          <strong>{job.client.name}</strong>
          <span className="mono">{job.client.phone}</span>
        </div>
        <a className="drv-round" href={telLink(job.client.phone)} aria-label="Call client"><Icon name="phone" size={19} /></a>
        <button className="drv-round" onClick={onChat} aria-label="Chat">
          <Icon name="chat" size={19} />{unread > 0 && <span className="badge">{unread}</span>}
        </button>
      </section>
      {isDelivery && job.receiver && (
        <section className="drv-client">
          <Avatar name={job.receiver.name} size={46} />
          <div><small>Receiver</small><strong>{job.receiver.name}</strong><span className="mono">{job.receiver.phone}</span></div>
          <a className="drv-round" href={telLink(job.receiver.phone)} aria-label="Call receiver"><Icon name="phone" size={19} /></a>
        </section>
      )}

      <div className="drv-actions">
        {job.status === 'accepted' && (
          <>
            <a className="btn btn-ghost" href={telLink(job.client.phone)}><Icon name="phone" size={18} /> Call {name}</a>
            <button className="btn btn-success" disabled={busy} onClick={() => onAsk('agree')}>
              <Icon name="check" size={18} stroke={3} /> We agreed on the price
            </button>
            <p className="drv-note">If you can't agree, {name} cancels and the request goes to another driver.</p>
          </>
        )}
        {job.status === 'to_pickup' && (
          <button className="btn btn-primary" disabled={busy} onClick={() => onAdvance('arrived')}>I've arrived</button>
        )}
        {job.status === 'arrived' && (
          <button className="btn btn-primary" disabled={busy} onClick={() => onAdvance('start')}>
            {isDelivery ? 'Package picked' : 'Start trip'}
          </button>
        )}
        {job.status === 'in_trip' && (
          <button className="btn btn-success" disabled={busy}
            onClick={() => onAdvance('complete', isDelivery ? 'Delivered. Great job!' : 'Trip completed. Great job!', true)}>
            <Icon name="check" size={18} stroke={3} /> {isDelivery ? 'Mark as delivered' : 'Complete trip'}
          </button>
        )}
        {job.status !== 'in_trip' && (
          <button className="link-btn" onClick={() => onAsk('release')}>
            {job.status === 'accepted' ? 'Client not answering?' : "I can't do this trip"}
          </button>
        )}
      </div>
      <section className="drv-facts">
        <div><small>Destination</small><strong>{job.dropoff.name}</strong></div>
        <div><small>Trip</small><strong>{job.tripKm} km</strong></div>
        <div><small>Payment</small><strong>{job.payment.method === 'cash' ? 'Cash' : 'Mobile Money'}</strong></div>
        {job.contents && <div><small>Package</small><strong>{cap(job.contents)} · {cap(job.size)}</strong></div>}
        {job.schedule?.mode === 'later' && <div><small>Scheduled</small><strong>{fmtDateTime(job.schedule.at)}</strong></div>}
        {job.airport?.flight && <div><small>Flight</small><strong>{job.airport.flight}</strong></div>}
      </section>

    </>
  );
}

/* ---------------- Trips history ---------------- */
function TripsPanel({ stats, me, catalog }) {
  const svc = (id) => catalog.services.find((s) => s.id === id);
  return (
    <>
      <section className="drv-page-head"><h2>Your trips</h2><p>Completed rides and deliveries</p></section>
      <section className="drv-stats">
        <div><small>Today</small><strong>{stats.tripsToday}</strong></div>
        <div><small>All time</small><strong>{stats.tripsTotal}</strong></div>
        <div><small>Rating</small><strong>{me.rating ? <>{me.rating.toFixed(1)}<em>★</em></> : '—'}</strong></div>
      </section>
      {stats.recent.length === 0 ? (
        <div className="drv-empty">
          <span>🛣️</span>
          <strong>No trips yet</strong>
          <p>Go online to get your first request. Completed trips will show here.</p>
        </div>
      ) : (
        <ul className="drv-trips">
          {stats.recent.map((t) => (
            <li key={t.id}>
              <span className="drv-trip-ico">{svc(t.service)?.emoji}</span>
              <div>
                <strong>{t.to}</strong>
                <small>{t.client} · {t.km} km · {fmtDateTime(t.doneAt)}</small>
              </div>
              <span className="drv-trip-rate">{t.rating ? `${t.rating}★` : '—'}</span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/* ---------------- Profile ---------------- */
function ProfilePanel({ me, stats, onEdit, onSignOut }) {
  return (
    <>
      <section className="drv-profile">
        <Avatar name={me.name} src={me.photo} size={104} />
        <h2>{me.name}</h2>
        <p className="mono">{me.phone}</p>
        <div className="drv-profile-badges">
          <span>{me.rating ? `★ ${me.rating.toFixed(1)} (${me.ratingCount})` : 'New driver'}</span>
          <span>{stats.tripsTotal} {stats.tripsTotal === 1 ? 'trip' : 'trips'}</span>
        </div>
      </section>
      <section className="drv-vehicle">
        {me.vehiclePhoto ? <img src={me.vehiclePhoto} alt={me.model} /> : <span className="drv-vehicle-emoji">{VEHICLE_EMOJI[me.vehicle]}</span>}
        <div>
          <small>Your vehicle</small>
          <strong>{me.model}</strong>
          <span>{me.color || '—'} · {me.vehicle === 'boda' ? 'Boda' : me.vehicle === 'car' ? 'Car' : 'Van'}</span>
        </div>
        <span className="plate">{me.plate}</span>
      </section>
      <p className="drv-note">Clients see your photo, name, vehicle and number plate when you accept their request.</p>
      <div className="drv-actions">
        <button className="btn btn-ghost" onClick={onEdit}><Icon name="edit" size={18} /> Edit profile</button>
        <button className="link-btn danger" onClick={onSignOut}><Icon name="logout" size={16} /> Sign out</button>
      </div>
    </>
  );
}

/* ---------------- Incoming request ---------------- */
function OfferAlert({ offer, svc, tierName, busy, onAnswer }) {
  const total = offer.offerExpiresInMs ?? 30000;
  const [deadline] = useState(() => Date.now() + total);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 200); return () => clearInterval(t); }, []);
  const left = Math.max(0, deadline - now);
  const frac = left / Math.max(total, 1);
  const R = 30;
  const C = 2 * Math.PI * R;

  return (
    <div className="overlay offer-overlay">
      <div className="offer-card drv-offer">
        <div className="drv-offer-top">
          <div>
            <span className="drv-eyebrow">New request</span>
            <h3>{svc.emoji} {svc.title}</h3>
            <small>{tierName} · {offer.payment.method === 'cash' ? 'Cash' : 'Mobile Money'}</small>
          </div>
          <div className="drv-countdown">
            <svg width="72" height="72" viewBox="0 0 72 72">
              <circle cx="36" cy="36" r={R} className="track" />
              <circle cx="36" cy="36" r={R} className="bar" strokeDasharray={C} strokeDashoffset={C * (1 - frac)} />
            </svg>
            <strong>{Math.ceil(left / 1000)}</strong>
          </div>
        </div>

        <div className="drv-offer-route">
          <div><span className="dot dot-pickup" /><div><small>Pickup</small><strong>{offer.pickupKm != null ? `${offer.pickupKm} km from you` : 'Near you'}</strong><em>Exact spot shared after price is agreed</em></div></div>
          <div><span className="dot dot-dropoff" /><div><small>Destination</small><strong>{offer.dropoff.name}</strong><em>{offer.dropoff.area}</em></div></div>
        </div>

        <div className="drv-facts compact">
          <div><small>Trip</small><strong>{offer.tripKm} km</strong></div>
          <div><small>Client</small><strong>{offer.client.name}</strong></div>
          {offer.contents && <div><small>Package</small><strong>{cap(offer.contents)} · {cap(offer.size)}</strong></div>}
          {offer.schedule?.mode === 'later' && <div><small>When</small><strong>{fmtDateTime(offer.schedule.at)}</strong></div>}
        </div>

        <div className="modal-actions">
          <button className="btn btn-ghost" disabled={busy} onClick={() => onAnswer(false)}>Decline</button>
          <button className="btn btn-success" disabled={busy} onClick={() => onAnswer(true)}>Accept</button>
        </div>
      </div>
    </div>
  );
}
