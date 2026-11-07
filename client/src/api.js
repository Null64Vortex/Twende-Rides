import { useEffect, useState } from 'react';

async function request(path, { method = 'GET', body } = {}) {
  let res;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error("Can't reach the Twende server. Is it running?");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Something went wrong');
  return data;
}

export const api = {
  catalog: () => request('/catalog'),
  places: (q = '') => request(`/places?q=${encodeURIComponent(q)}`),
  route: (from, to) => request(`/route?from=${from}&to=${to}`),
  quote: (body) => request('/quote', { method: 'POST', body }),
  book: (body) => request('/bookings', { method: 'POST', body }),
  booking: (id) => request(`/bookings/${id}`),
  start: (id) => request(`/bookings/${id}/start`, { method: 'POST' }),
  cancel: (id) => request(`/bookings/${id}/cancel`, { method: 'POST' }),
  rate: (id, stars) => request(`/bookings/${id}/rating`, { method: 'POST', body: { stars } }),
  message: (id, text) => request(`/bookings/${id}/messages`, { method: 'POST', body: { text } }),
};

export function coreRequest(d) {
  return {
    service: d.service,
    vehicle: d.vehicle,
    tier: d.tier,
    pickupId: d.pickup?.id,
    dropoffId: d.dropoff?.id,
    size: d.service === 'delivery' ? d.size : undefined,
  };
}

export function bookingRequest(d) {
  return {
    ...coreRequest(d),
    schedule: { mode: d.when, at: d.when === 'later' && d.at ? new Date(d.at).toISOString() : null },
    airport: d.service === 'airport' ? { direction: d.airportDirection, flight: d.flight } : undefined,
    delivery: d.service === 'delivery' ? { sender: d.sender, receiver: d.receiver, contents: d.contents } : undefined,
    payment: { method: d.payment, phone: d.momoPhone },
  };
}

const FINAL = ['done', 'cancelled'];

// Polls a booking every second until it is finished.
export function useBooking(id) {
  const [booking, setBooking] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    if (!id) return undefined;
    let alive = true;
    let timer;
    const tick = async () => {
      let data = null;
      try {
        data = await api.booking(id);
        if (alive) { setBooking(data); setError(null); }
      } catch (e) {
        if (alive) setError(e.message);
      }
      if (alive && !FINAL.includes(data?.phase)) timer = setTimeout(tick, 1000);
    };
    tick();
    return () => { alive = false; clearTimeout(timer); };
  }, [id]);
  return { booking, setBooking, error };
}
