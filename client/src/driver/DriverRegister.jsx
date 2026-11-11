import { useState } from 'react';
import { driverApi } from '../api.js';
import Icon from '../components/Icon.jsx';
import { Field, Logo, Segmented, Spinner } from '../components/ui.jsx';
import { resizeImage, validPhone } from '../lib.js';

const EMPTY = { name: '', phone: '', vehicle: 'boda', model: '', plate: '', color: '', photo: '', vehiclePhoto: null };

export default function DriverRegister({ initial, session, onSaved, onCancel }) {
  const [p, setP] = useState({ ...EMPTY, ...(initial || {}) });
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const set = (patch) => setP((x) => ({ ...x, ...patch }));

  const errors = {};
  if (!p.photo) errors.photo = 'Add a clear photo of your face';
  if (p.name.trim().length < 2) errors.name = 'Enter your full name';
  if (!validPhone(p.phone)) errors.phone = 'e.g. 0772 123456';
  if (p.model.trim().length < 2) errors.model = 'e.g. Bajaj Boxer 150';
  if (!/^[A-Z0-9 ]{4,12}$/i.test(p.plate.trim())) errors.plate = 'e.g. UEX 452K';
  const err = (k) => (tried ? errors[k] : null);

  const pickPhoto = (key) => async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try { set({ [key]: await resizeImage(file, key === 'photo' ? 360 : 480) }); } catch (x) { setError(x.message); }
  };

  async function save() {
    setTried(true);
    if (Object.keys(errors).length) return;
    setBusy(true);
    setError(null);
    try {
      const profile = { ...p, plate: p.plate.trim().toUpperCase() };
      const r = await driverApi(session).register(profile);
      onSaved({ id: r.id, token: r.token }, profile);
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  return (
    <div className="screen">
      <header className="driver-reg-head">
        {onCancel
          ? <button className="icon-btn" onClick={onCancel} aria-label="Back"><Icon name="back" /></button>
          : <Logo />}
        <span className="driver-badge">Driver</span>
      </header>
      <div className="screen-body">
        <div>
          <h2 className="big-title">{initial ? 'Your driver profile' : 'Drive with Twende Ride App'}</h2>
          <p className="muted">Clients see your photo, vehicle and number plate before you meet, so they know it's you.</p>
        </div>

        <label className={`photo-pick ${err('photo') ? 'has-error' : ''}`}>
          {p.photo ? <img src={p.photo} alt="You" /> : <span className="photo-empty"><Icon name="user" size={34} /></span>}
          <span className="photo-text">
            <strong>{p.photo ? 'Change photo' : 'Take your photo'}</strong>
            <small>{err('photo') || 'Face the camera, good light, no sunglasses'}</small>
          </span>
          <input type="file" accept="image/*" capture="user" onChange={pickPhoto('photo')} hidden />
        </label>

        <div className="two-col">
          <Field label="Full name" error={err('name')}>
            <input className="input" value={p.name} onChange={(e) => set({ name: e.target.value })} placeholder="Moses Kato" autoComplete="name" />
          </Field>
          <Field label="Phone" error={err('phone')}>
            <input className="input" type="tel" inputMode="tel" value={p.phone} onChange={(e) => set({ phone: e.target.value })} placeholder="07XX XXX XXX" autoComplete="tel" />
          </Field>
        </div>

        <div className="form-block">
          <span className="block-title">Your vehicle</span>
          <Segmented value={p.vehicle} onChange={(v) => set({ vehicle: v })}
            options={[{ id: 'boda', label: '🏍️ Boda' }, { id: 'car', label: '🚗 Car' }, { id: 'van', label: '🚐 Van' }]} />
        </div>

        <div className="two-col">
          <Field label="Model" error={err('model')}>
            <input className="input" value={p.model} onChange={(e) => set({ model: e.target.value })}
              placeholder={p.vehicle === 'boda' ? 'Bajaj Boxer' : p.vehicle === 'car' ? 'Toyota Premio' : 'Toyota HiAce'} />
          </Field>
          <Field label="Color">
            <input className="input" value={p.color} onChange={(e) => set({ color: e.target.value })} placeholder="Red" />
          </Field>
        </div>
        <Field label="Number plate" error={err('plate')}>
          <input className="input plate-input" value={p.plate} onChange={(e) => set({ plate: e.target.value.toUpperCase() })}
            placeholder={p.vehicle === 'boda' ? 'UEX 452K' : 'UBK 318T'} maxLength={12} />
        </Field>

        <label className="photo-pick vehicle">
          {p.vehiclePhoto ? <img src={p.vehiclePhoto} alt="Vehicle" /> : <span className="photo-empty">📷</span>}
          <span className="photo-text">
            <strong>{p.vehiclePhoto ? 'Change vehicle photo' : 'Vehicle photo (optional)'}</strong>
            <small>Show the plate clearly</small>
          </span>
          <input type="file" accept="image/*" capture="environment" onChange={pickPhoto('vehiclePhoto')} hidden />
        </label>

        {error && <div className="alert">{error}</div>}
      </div>
      <div className="screen-footer">
        <button className="btn btn-primary" onClick={save} disabled={busy}>
          {busy ? <Spinner /> : initial ? 'Save profile' : 'Create driver account'}
        </button>
      </div>
    </div>
  );
}
