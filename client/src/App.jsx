import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api.js';
import { Logo, Spinner } from './components/ui.jsx';
import Home from './screens/Home.jsx';
import { ClassStep, ServiceStep, VehicleStep } from './screens/ChoiceSteps.jsx';
import DetailsStep from './screens/DetailsStep.jsx';
import ConfirmStep from './screens/ConfirmStep.jsx';
import MatchingScreen from './screens/MatchingScreen.jsx';
import TripScreen from './screens/TripScreen.jsx';

const FLOW = ['service', 'vehicle', 'class', 'details', 'confirm'];
const DEFAULT_PICKUP = 'kasangati';

function newDraft(places) {
  return {
    service: null,
    vehicle: null,
    tier: null,
    pickup: places.find((p) => p.id === DEFAULT_PICKUP) || null,
    dropoff: null,
    when: 'now',
    at: '',
    airportDirection: 'to',
    flight: '',
    sender: { name: '', phone: '' },
    receiver: { name: '', phone: '' },
    contents: null,
    size: 'small',
    payment: 'cash',
    momoPhone: '',
  };
}

export default function App() {
  const [catalog, setCatalog] = useState(null);
  const [places, setPlaces] = useState([]);
  const [loadError, setLoadError] = useState(null);
  const [screen, setScreen] = useState('home');
  const [draft, setDraft] = useState(null);
  const [bookingId, setBookingId] = useState(null);
  const [toastMsg, setToastMsg] = useState(null);
  const toastTimer = useRef();

  const load = useCallback(() => {
    setLoadError(null);
    Promise.all([api.catalog(), api.places()])
      .then(([c, p]) => { setCatalog(c); setPlaces(p); setDraft(newDraft(p)); })
      .catch((e) => setLoadError(e.message));
  }, []);
  useEffect(load, [load]);

  const toast = useCallback((msg) => {
    setToastMsg(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(null), 2600);
  }, []);

  const update = useCallback((patch) => setDraft((d) => ({ ...d, ...patch })), []);
  const next = useCallback(() => setScreen((s) => FLOW[FLOW.indexOf(s) + 1] || s), []);
  const back = useCallback(() => setScreen((s) => (FLOW.indexOf(s) > 0 ? FLOW[FLOW.indexOf(s) - 1] : 'home')), []);
  const goHome = useCallback(() => {
    setDraft(newDraft(places));
    setBookingId(null);
    setScreen('home');
  }, [places]);

  let content;
  if (loadError) {
    content = (
      <div className="screen center-screen">
        <Logo />
        <p className="muted center">{loadError}</p>
        <button className="btn btn-primary narrow" onClick={load}>Try again</button>
      </div>
    );
  } else if (!catalog || !draft) {
    content = <div className="screen center-screen splash"><Logo light /><Spinner /></div>;
  } else {
    const props = { catalog, places, draft, update, next, back, toast };
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
        content = <ConfirmStep {...props} onBooked={(id) => { setBookingId(id); setScreen('matching'); }} />;
        break;
      case 'matching':
        content = <MatchingScreen bookingId={bookingId} toast={toast} onHome={goHome} onTrack={() => setScreen('trip')} />;
        break;
      case 'trip':
        content = <TripScreen bookingId={bookingId} toast={toast} onHome={goHome} />;
        break;
      default:
        content = null;
    }
  }

  return (
    <div className="stage">
      <aside className="stage-aside">
        <Logo light />
        <h1>Rides, airport trips, moving and deliveries across Kampala.</h1>
        <ul>
          <li>🚖 Ride: you travel</li>
          <li>✈️ Airport: to and from Entebbe</li>
          <li>📦 Moving: you plus your house or luggage</li>
          <li>🛵 Delivery: just your package</li>
        </ul>
        <p>Pay with cash or Mobile Money.</p>
      </aside>
      <div className="phone">
        <div className="screen-anim" key={screen}>{content}</div>
        {toastMsg && <div className="toast" role="status">{toastMsg}</div>}
      </div>
    </div>
  );
}
