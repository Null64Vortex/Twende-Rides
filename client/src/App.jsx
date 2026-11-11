import { useCallback, useEffect, useRef, useState } from 'react';
import { api, store } from './api.js';
import { Logo, Spinner } from './components/ui.jsx';
import { gpsPlace, useGeolocation } from './geo.js';
import DriverApp from './driver/DriverApp.jsx';
import Home from './screens/Home.jsx';
import { ClassStep, ServiceStep, VehicleStep } from './screens/ChoiceSteps.jsx';
import DetailsStep from './screens/DetailsStep.jsx';
import ConfirmStep from './screens/ConfirmStep.jsx';
import LiveBooking from './screens/LiveBooking.jsx';

const FLOW = ['service', 'vehicle', 'class', 'details', 'confirm'];
const ME_KEY = 'twende.me';
const BOOKING_KEY = 'twende.booking';
const isDriverMode = () => window.location.pathname.startsWith('/driver');

function newDraft() {
  const me = store.get(ME_KEY) || { name: '', phone: '' };
  return {
    service: null,
    vehicle: null,
    tier: null,
    pickup: null,
    dropoff: null,
    when: 'now',
    at: '',
    airportDirection: 'to',
    flight: '',
    me,
    sender: { ...me },
    receiver: { name: '', phone: '' },
    contents: null,
    size: 'small',
    payment: 'cash',
  };
}

const movedMeters = (a, b) => Math.hypot(a.lat - b.lat, (a.lng - b.lng) * Math.cos((a.lat * Math.PI) / 180)) * 111_000;

export default function App() {
  const driverMode = isDriverMode();
  const [catalog, setCatalog] = useState(null);
  const [places, setPlaces] = useState([]);
  const [loadError, setLoadError] = useState(null);
  const [booking, setBooking] = useState(() => (driverMode ? null : store.get(BOOKING_KEY)));
  const [screen, setScreen] = useState(() => (booking ? 'live' : 'home'));
  const [draft, setDraft] = useState(newDraft);
  const [nearby, setNearby] = useState(null);
  const [toastMsg, setToastMsg] = useState(null);
  const toastTimer = useRef();
  const geo = useGeolocation(!driverMode);
  const gps = geo.pos ? gpsPlace(geo.pos) : null;

  const load = useCallback(() => {
    setLoadError(null);
    Promise.all([api.catalog(), api.places()])
      .then(([c, p]) => { setCatalog(c); setPlaces(p); })
      .catch((e) => setLoadError(e.message));
  }, []);
  useEffect(load, [load]);

  // Use the phone's GPS as pickup unless the client picked a place by hand.
  useEffect(() => {
    if (!geo.pos) return;
    setDraft((d) => {
      if (d.pickup && !d.pickup.gps) return d;
      if (d.pickup && movedMeters(d.pickup, geo.pos) < 25) return d;
      return { ...d, pickup: gpsPlace(geo.pos) };
    });
  }, [geo.pos]);

  // How many drivers are online nearby (no positions, just counts).
  const hasPos = !!geo.pos;
  useEffect(() => {
    if (!hasPos || !['home', 'vehicle'].includes(screen)) return undefined;
    let alive = true;
    const fetchNearby = () => api.nearby(geo.pos).then((n) => alive && setNearby(n)).catch(() => {});
    fetchNearby();
    const t = setInterval(fetchNearby, 15000);
    return () => { alive = false; clearInterval(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasPos, screen]);

  const toast = useCallback((msg) => {
    setToastMsg(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(null), 2800);
  }, []);

  const update = useCallback((patch) => setDraft((d) => ({ ...d, ...patch })), []);
  const next = useCallback(() => setScreen((s) => FLOW[FLOW.indexOf(s) + 1] || s), []);
  const back = useCallback(() => setScreen((s) => (FLOW.indexOf(s) > 0 ? FLOW[FLOW.indexOf(s) - 1] : 'home')), []);
  const finishBooking = useCallback(() => {
    store.remove(BOOKING_KEY);
    setBooking(null);
    setDraft(newDraft());
    setScreen('home');
  }, []);

  let content;
  if (loadError) {
    content = (
      <div className="screen center-screen">
        <Logo />
        <p className="muted center">{loadError}</p>
        <button className="btn btn-primary narrow" onClick={load}>Try again</button>
      </div>
    );
  } else if (!catalog) {
    content = <div className="screen center-screen splash"><Logo light /><Spinner /></div>;
  } else if (driverMode) {
    content = <DriverApp catalog={catalog} toast={toast} />;
  } else {
    const props = { catalog, places, draft, update, next, back, toast, gps, gpsError: geo.error, nearby };
    switch (screen) {
      case 'home':
        content = (
          <Home {...props}
            onDestination={(p) => { update({ dropoff: p }); setScreen('service'); }}
            onQuick={(service) => { update({ service }); setScreen('vehicle'); }} />
        );
        break;
      case 'service': content = <ServiceStep {...props} />; break;
      case 'vehicle': content = <VehicleStep {...props} />; break;
      case 'class': content = <ClassStep {...props} />; break;
      case 'details': content = <DetailsStep {...props} />; break;
      case 'confirm':
        content = (
          <ConfirmStep {...props} onBooked={(s) => {
            store.set(ME_KEY, draft.service === 'delivery' ? draft.sender : draft.me);
            store.set(BOOKING_KEY, s);
            setBooking(s);
            setScreen('live');
          }} />
        );
        break;
      case 'live':
        content = booking ? <LiveBooking session={booking} gpsPos={geo.pos} toast={toast} onFinish={finishBooking} /> : null;
        break;
      default:
        content = null;
    }
  }

  return (
    <div className="stage">
      <aside className="stage-aside">
        <Logo light />
        {driverMode ? (
          <>
            <h1>Drive with Twende Ride App and get clients near you.</h1>
            <ul>
              <li>📸 Add your photo, vehicle and plate</li>
              <li>🟢 Go online and keep the app open</li>
              <li>🔔 Accept a request, call the client, agree the price</li>
              <li>📍 See their location and go pick them up</li>
            </ul>
            <p><a href="/">Open the client app →</a></p>
          </>
        ) : (
          <>
            <h1>Rides, airport trips, moving and deliveries across Kampala.</h1>
            <ul>
              <li>🚖 Ride: you travel</li>
              <li>✈️ Airport: to and from Entebbe</li>
              <li>📦 Moving: you plus your house or luggage</li>
              <li>🛵 Delivery: just your package</li>
            </ul>
            <p>No fixed prices: agree with your driver by phone. <a href="/driver">Drive with us →</a></p>
          </>
        )}
      </aside>
      <div className="phone">
        <div className="screen-anim" key={driverMode ? 'driver' : screen}>{content}</div>
        {toastMsg && <div className="toast" role="status">{toastMsg}</div>}
      </div>
    </div>
  );
}
