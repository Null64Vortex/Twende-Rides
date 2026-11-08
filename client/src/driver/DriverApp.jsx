import { useState } from 'react';
import { store } from '../api.js';
import DriverDashboard from './DriverDashboard.jsx';
import DriverRegister from './DriverRegister.jsx';

const SESSION_KEY = 'twende.driver.session';
const PROFILE_KEY = 'twende.driver.profile';

// Everything under .drv uses the dark "driver mode" theme.
export default function DriverApp({ catalog, toast }) {
  const [session, setSession] = useState(() => store.get(SESSION_KEY));
  const [profile, setProfile] = useState(() => store.get(PROFILE_KEY));
  const [editing, setEditing] = useState(false);

  const saveSession = (s) => { store.set(SESSION_KEY, s); setSession(s); };
  const signOut = () => {
    store.remove(SESSION_KEY);
    store.remove(PROFILE_KEY);
    setSession(null);
    setProfile(null);
  };

  return (
    <div className="drv">
      {!session || !profile || editing ? (
        <DriverRegister initial={profile} session={session}
          onCancel={editing ? () => setEditing(false) : null}
          onSaved={(s, p) => { store.set(PROFILE_KEY, p); setProfile(p); saveSession(s); setEditing(false); toast('Profile saved'); }} />
      ) : (
        <DriverDashboard catalog={catalog} session={session} profile={profile}
          onSession={saveSession} onEdit={() => setEditing(true)} onSignOut={signOut} toast={toast} />
      )}
    </div>
  );
}
