import { useEffect, useRef, useState } from 'react';

async function request(path, { method = 'GET', body, headers = {} } = {}) {
  let res;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error("Can't reach Twende Ride App. Check your internet connection.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || 'Something went wrong');
    err.status = res.status;
    throw err;
  }
  return data;
}

const ll = (p) => `${p.lat},${p.lng}`;

export const api = {
  catalog: () => request('/catalog'),
  places: (q = '') => request(`/places?q=${encodeURIComponent(q)}`),
  route: (a, b) => request(`/route?a=${ll(a)}&b=${ll(b)}`),
  nearby: (p) => request(`/drivers/nearby?at=${ll(p)}`),
  book: (body) => request('/bookings', { method: 'POST', body }),
};

// Client actions on one booking (token proves it's theirs).
export function bookingApi({ id, token }) {
  const headers = { 'X-Booking-Token': token };
  const post = (action, body = {}) => request(`/bookings/${id}/${action}`, { method: 'POST', body, headers });
  return {
    get: () => request(`/bookings/${id}`, { headers }),
    notAgreed: () => post('not-agreed'),
    retry: () => post('retry'),
    cancel: () => post('cancel'),
    location: (p) => post('location', p),
    message: (text) => post('messages', { text }),
    rate: (stars) => post('rating', { stars }),
  };
}

export function driverApi(session) {
  const headers = { 'X-Driver-Id': session?.id || '', 'X-Driver-Token': session?.token || '' };
  const post = (path, body = {}) => request(`/driver/${path}`, { method: 'POST', body, headers });
  return {
    register: (profile) => request('/drivers', { method: 'POST', body: { id: session?.id, token: session?.token, profile } }),
    me: () => request('/driver/me', { headers }),
    status: (online) => post('status', { online }),
    location: (p) => post('location', p),
    respond: (bookingId, accept) => post(`offer/${bookingId}/${accept ? 'accept' : 'decline'}`),
    advance: (action) => post(`job/${action}`),
    message: (text) => post('job/messages', { text }),
  };
}

export function bookingRequest(d) {
  const isDelivery = d.service === 'delivery';
  return {
    service: d.service,
    vehicle: d.vehicle,
    tier: d.tier,
    ...(d.pickup?.gps ? { pickupGps: { lat: d.pickup.lat, lng: d.pickup.lng } } : { pickupId: d.pickup?.id }),
    dropoffId: d.dropoff?.id,
    size: isDelivery ? d.size : undefined,
    client: isDelivery ? d.sender : d.me,
    schedule: { mode: d.when, at: d.when === 'later' && d.at ? new Date(d.at).toISOString() : null },
    airport: d.service === 'airport' ? { direction: d.airportDirection, flight: d.flight } : undefined,
    delivery: isDelivery ? { receiver: d.receiver, contents: d.contents } : undefined,
    payment: { method: d.payment },
  };
}

// Calls `fn` every `ms` while mounted; keeps the latest result.
export function usePoll(fn, ms, deps = []) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  useEffect(() => {
    let alive = true;
    let timer;
    const tick = async () => {
      try {
        const d = await fnRef.current();
        if (alive) { setData(d); setError(null); }
      } catch (e) {
        if (alive) setError(e);
      }
      if (alive) timer = setTimeout(tick, ms);
    };
    tick();
    return () => { alive = false; clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return { data, setData, error };
}

/* Small localStorage helpers that never throw. */
export const store = {
  get(key) { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } },
  set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage full or blocked */ } },
  remove(key) { try { localStorage.removeItem(key); } catch { /* ignore */ } },
};
