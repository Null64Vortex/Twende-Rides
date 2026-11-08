import { useEffect, useMemo, useRef, useState } from 'react';
import { driverApi, usePoll } from '../api.js';
import ChatSheet from '../components/ChatSheet.jsx';
import Icon from '../components/Icon.jsx';
import MapView from '../components/MapView.jsx';
import { Avatar, Modal, Spinner } from '../components/ui.jsx';
import { keepAwake, mapsLink, ring, unlockAudio, useGeolocation, useLocationSender } from '../geo.js';
import { firstName, fmtDateTime, telLink } from '../lib.js';

export default function DriverDashboard({ catalog, session, profile, onSession, onEdit, toast }) {
  const dApi = useMemo(() => driverApi(session), [session]);
  const { data: state, setData, error } = usePoll(() => dApi.me(), 2000, [session.id, session.token]);
  const geo = useGeolocation(true);
  const online = !!state?.driver.online;
  const job = state?.job || null;
  const offer = state?.offer || null;
  const [busy, setBusy] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [seen, setSeen] = useState(0);
  const [askRelease, setAskRelease] = useState(false);

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

  // Tell the driver when the client ends the request.
  const prevJob = useRef(null);
  const ending = useRef(false);
  useEffect(() => {
    const prev = prevJob.current;
    if (prev && !job && !ending.current) toast(`${firstName(prev.client.name)} cancelled or chose another driver`);
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
    }
  };

  const goOnline = async () => {
    unlockAudio();
    if (!geo.pos) { toast(geo.error || 'Waiting for your GPS location...'); return; }
    await dApi.location(geo.pos).catch(() => {});
    act(() => dApi.status(true), "You're online");
  };

  if (!state) {
    return <div className="screen center-screen">{error && error.status !== 401 ? <p className="muted center">{error.message}</p> : <Spinner />}</div>;
  }

  const me = state.driver;
  const myPos = geo.pos ? [geo.pos.lat, geo.pos.lng] : me.position;
  const svc = (id) => catalog.services.find((s) => s.id === id);
  const tierName = (id) => catalog.tiers.find((t) => t.id === id)?.name;
  const isDelivery = job?.service === 'delivery';
  const clientMsgs = job ? job.messages.filter((m) => m.from === 'client').length : 0;
  const unread = chatOpen ? 0 : Math.max(0, clientMsgs - seen);

  // Map: only my position until the client confirms the price; then the client's live location.
  const clientPin = job?.clientPos ? { lat: job.clientPos[0], lng: job.clientPos[1] } : null;
  const toDropoff = job?.status === 'in_trip';
  const fitPoints = !job || !job.revealed
    ? [myPos].filter(Boolean)
    : toDropoff ? [myPos, [job.dropoff.lat, job.dropoff.lng]].filter(Boolean) : [myPos, job.clientPos].filter(Boolean);

  return (
    <div className="screen trip driver-screen">
      <div className="trip-map">
        <MapView vehicle={me.vehicle} driver={myPos} pickup={clientPin}
          dropoff={job?.revealed ? job.dropoff : null}
          toPickupRoute={job?.revealed && !toDropoff && myPos && job.clientPos ? [myPos, job.clientPos] : null}
          tripRoute={toDropoff ? job.tripRoute : null}
          fitPoints={fitPoints} fitKey={`${job?.status || 'idle'}-${myPos ? 1 : 0}`} padTop={90} padBottom={job ? 420 : 300} />
      </div>
      <div className="trip-topbar">
        <button className="profile-chip" onClick={onEdit}>
          <Avatar name={me.name} src={me.photo} size={34} />
          <span><strong>{firstName(me.name)}</strong><small>{me.plate}</small></span>
        </button>
        <span className={`status-pill ${online ? 'on' : ''}`}><span className="status-dot" />{online ? 'Online' : 'Offline'}</span>
      </div>

      <div className="trip-sheet">
        <span className="sheet-handle" />
        {!job && (online ? (
          <>
            <div className="status-head"><div>
              <h2>Looking for requests</h2>
              <p className="muted">Keep this screen open. We'll ring when a client near you needs a {me.vehicle === 'boda' ? 'boda' : me.vehicle}.</p>
            </div><span className="radar-mini" /></div>
            {!me.gpsFresh && <div className="hint-card">📍 Waiting for your GPS signal...</div>}
            <button className="btn btn-ghost" disabled={busy} onClick={() => act(() => dApi.status(false), "You're offline")}>Go offline</button>
          </>
        ) : (
          <>
            <div className="status-head"><div>
              <h2>You're offline</h2>
              <p className="muted">Go online to receive ride and delivery requests near you.</p>
            </div></div>
            {geo.error && <div className="alert">{geo.error}</div>}
            <button className="btn btn-primary" disabled={busy} onClick={goOnline}>Go online</button>
          </>
        ))}

        {job && (
          <>
            <JobHeader job={job} svc={svc(job.service)} tierName={tierName(job.tier)} />

            {job.status === 'accepted' && (
              <>
                <a className="btn btn-primary" href={telLink(job.client.phone)}>
                  <Icon name="phone" size={18} /> Call {firstName(job.client.name)} · {job.client.phone}
                </a>
                <div className="waiting-line"><Spinner /> Agree on the price. {firstName(job.client.name)} then confirms in the app, and their location appears here.</div>
              </>
            )}

            {job.revealed && job.status !== 'in_trip' && (
              <div className="action-row">
                <a className="action" href={mapsLink(job.clientPos[0], job.clientPos[1])} target="_blank" rel="noreferrer">
                  <span className="action-ico"><Icon name="route" size={20} /></span>Navigate
                </a>
                <a className="action" href={telLink(job.client.phone)}><span className="action-ico"><Icon name="phone" size={20} /></span>Call</a>
                <button className="action" onClick={() => { setChatOpen(true); setSeen(clientMsgs); }}>
                  <span className="action-ico"><Icon name="chat" size={20} />{unread > 0 && <span className="badge">{unread}</span>}</span>Chat
                </button>
              </div>
            )}
            {job.status === 'in_trip' && (
              <div className="action-row">
                <a className="action" href={mapsLink(job.dropoff.lat, job.dropoff.lng)} target="_blank" rel="noreferrer">
                  <span className="action-ico"><Icon name="route" size={20} /></span>Navigate
                </a>
                <a className="action" href={telLink(isDelivery && job.receiver ? job.receiver.phone : job.client.phone)}>
                  <span className="action-ico"><Icon name="phone" size={20} /></span>{isDelivery ? 'Call receiver' : 'Call'}
                </a>
                <button className="action" onClick={() => { setChatOpen(true); setSeen(clientMsgs); }}>
                  <span className="action-ico"><Icon name="chat" size={20} />{unread > 0 && <span className="badge">{unread}</span>}</span>Chat
                </button>
              </div>
            )}

            {job.status === 'to_pickup' && (
              <button className="btn btn-primary" disabled={busy} onClick={() => act(() => dApi.advance('arrived'))}>I've arrived</button>
            )}
            {job.status === 'arrived' && (
              <button className="btn btn-primary" disabled={busy} onClick={() => act(() => dApi.advance('start'))}>
                {isDelivery ? 'Package picked' : 'Start trip'}
              </button>
            )}
            {job.status === 'in_trip' && (
              <button className="btn btn-primary" disabled={busy}
                onClick={() => act(() => dApi.advance('complete'), isDelivery ? 'Delivered. Great job!' : 'Trip completed. Great job!', true)}>
                {isDelivery ? 'Mark as delivered' : 'Complete trip'}
              </button>
            )}
            {job.status !== 'in_trip' && (
              <button className="link-btn" onClick={() => setAskRelease(true)}>
                {job.status === 'accepted' ? "We couldn't agree" : "I can't do this trip"}
              </button>
            )}
          </>
        )}
      </div>

      {offer && <OfferAlert key={offer.id} offer={offer} svc={svc(offer.service)} tierName={tierName(offer.tier)} busy={busy}
        onAnswer={(yes) => act(() => dApi.respond(offer.id, yes), yes ? `Accepted. Call ${offer.client.name} now.` : null)} />}

      {askRelease && (
        <Modal title="Release this request?" onClose={() => setAskRelease(false)}
          actions={<>
            <button className="btn btn-ghost" onClick={() => setAskRelease(false)}>Go back</button>
            <button className="btn btn-danger" onClick={() => { setAskRelease(false); act(() => dApi.advance('release'), 'Request released', true); }}>Release</button>
          </>}>
          We'll find {firstName(job.client.name)} another driver.
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

function JobHeader({ job, svc, tierName }) {
  const isDelivery = job.service === 'delivery';
  const name = firstName(job.client.name);
  let title = '';
  if (job.status === 'accepted') title = `Call ${name} to agree on the price`;
  if (job.status === 'to_pickup') title = `Go to ${name}`;
  if (job.status === 'arrived') title = isDelivery ? 'Collect the package' : `Waiting for ${name}`;
  if (job.status === 'in_trip') title = isDelivery ? `Deliver to ${job.receiver?.name || job.dropoff.name}` : `Drive to ${job.dropoff.name}`;
  const sub = job.status === 'to_pickup' && job.pickupKm != null
    ? `${job.pickupKm} km away${job.etaMin ? ` · about ${job.etaMin} min` : ''}`
    : job.status === 'in_trip' && job.etaMin ? `About ${job.etaMin} min to ${job.dropoff.name}` : null;
  return (
    <>
      <div className="status-head"><div><h2>{title}</h2>{sub && <p className="muted">{sub}</p>}</div></div>
      <div className="job-facts">
        <span>{svc.emoji} {svc.name} · {tierName}</span>
        <span>🏁 {job.dropoff.name} · {job.tripKm} km</span>
        {job.contents && <span>📦 {job.contents} · {job.size}</span>}
        {job.schedule?.mode === 'later' && <span>📅 {fmtDateTime(job.schedule.at)}</span>}
        {job.airport?.flight && <span>✈️ {job.airport.flight}</span>}
        <span>{job.payment.method === 'cash' ? '💵 Cash' : '📱 Mobile Money'}</span>
      </div>
    </>
  );
}

function OfferAlert({ offer, svc, tierName, busy, onAnswer }) {
  const [deadline] = useState(() => Date.now() + (offer.offerExpiresInMs ?? 30000));
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(t); }, []);
  const left = Math.max(0, deadline - now);
  const total = offer.offerExpiresInMs ?? 30000;

  return (
    <div className="overlay offer-overlay">
      <div className="offer-card">
        <div className="offer-timer"><div style={{ width: `${(left / Math.max(total, 1)) * 100}%` }} /></div>
        <div className="offer-top">
          <span className="offer-emoji">{svc.emoji}</span>
          <div>
            <span className="offer-tag">New {svc.name.toLowerCase()} request</span>
            <strong>{Math.ceil(left / 1000)}s to answer</strong>
          </div>
        </div>
        <div className="offer-dest">
          <small>Going to</small>
          <h2>{offer.dropoff.name}</h2>
          <span className="muted">{offer.dropoff.area}</span>
        </div>
        <div className="offer-grid">
          <div><small>Client is</small><strong>{offer.pickupKm != null ? `${offer.pickupKm} km` : '—'}</strong><span>from you</span></div>
          <div><small>Trip about</small><strong>{offer.tripKm} km</strong><span>{tierName}</span></div>
        </div>
        <div className="job-facts">
          <span>👤 {offer.client.name}</span>
          {offer.contents && <span>📦 {offer.contents} · {offer.size}</span>}
          {offer.schedule?.mode === 'later' && <span>📅 {fmtDateTime(offer.schedule.at)}</span>}
          <span>{offer.payment.method === 'cash' ? '💵 Cash' : '📱 Mobile Money'}</span>
        </div>
        <p className="muted small">Exact pickup location is shared after you and the client agree on the price.</p>
        <div className="modal-actions">
          <button className="btn btn-ghost" disabled={busy} onClick={() => onAnswer(false)}>Decline</button>
          <button className="btn btn-primary" disabled={busy} onClick={() => onAnswer(true)}>Accept</button>
        </div>
      </div>
    </div>
  );
}
