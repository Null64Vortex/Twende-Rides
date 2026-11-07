import crypto from 'node:crypto';
import { pickDriver } from './drivers.js';
import { route, pointAlong, offsetPoint } from './routing.js';
import { speedFor } from './catalog.js';

// Simulated timeline (milliseconds). Kept short so the demo is fun to watch.
const SEARCH_MS = 4500;
const TO_PICKUP_MS = 20000;
const AT_PICKUP_MS = 6000;
const TRIP_MS = 45000;

const bookings = new Map();

const word = (vehicleId) => (vehicleId === 'boda' ? 'rider' : 'driver');
const cap = (s) => s[0].toUpperCase() + s.slice(1);

export async function createBooking(data) {
  const id = crypto.randomBytes(3).toString('hex').toUpperCase();
  const driver = pickDriver(data.vehicle.id, data.tier.id);
  const start = offsetPoint(data.pickup, 1.2 + Math.random() * 1.3);
  const [toPickup, trip] = await Promise.all([route(start, data.pickup), route(data.pickup, data.dropoff)]);
  const now = Date.now();
  const matchedAt = now + SEARCH_MS;
  const b = {
    id,
    ...data,
    driver,
    routes: { toPickup, trip },
    createdAt: now,
    matchedAt,
    startAt: data.schedule.mode === 'now' ? matchedAt : null,
    cancelledAt: null,
    rating: null,
    messages: [],
  };
  const first = driver.name.split(' ')[0];
  b.messages.push({
    from: 'driver',
    text: data.schedule.mode === 'now'
      ? `Hello! I'm ${first}, your ${word(data.vehicle.id)}. Coming to ${data.pickup.name} now ${data.vehicle.emoji}`
      : `Hello! I'm ${first}. I've received your booking and will be there on time 👍`,
    at: matchedAt + 2500,
  });
  bookings.set(id, b);
  return view(b);
}

export const getBooking = (id) => {
  const b = bookings.get(id);
  return b ? view(b) : null;
};

function phaseOf(b, now) {
  if (b.cancelledAt) return { phase: 'cancelled' };
  if (now < b.matchedAt) return { phase: 'searching' };
  if (!b.startAt) return { phase: 'scheduled' };
  const t = now - b.startAt;
  if (t < TO_PICKUP_MS) return { phase: 'to_pickup', f: t / TO_PICKUP_MS };
  if (t < TO_PICKUP_MS + AT_PICKUP_MS) return { phase: 'at_pickup' };
  const t2 = t - TO_PICKUP_MS - AT_PICKUP_MS;
  if (t2 < TRIP_MS) return { phase: 'in_trip', f: t2 / TRIP_MS };
  return { phase: 'done' };
}

function labelFor(b, phase) {
  const w = word(b.vehicle.id);
  if (b.service.id === 'delivery') {
    return {
      searching: `Finding your ${w}...`,
      scheduled: `${cap(w)} booked`,
      to_pickup: `${cap(w)} heading to pickup`,
      at_pickup: 'Package Picked',
      in_trip: 'On the way',
      done: 'Delivered',
      cancelled: 'Delivery cancelled',
    }[phase];
  }
  return {
    searching: `Finding your ${w}...`,
    scheduled: 'Trip scheduled',
    to_pickup: `${cap(w)} on the way`,
    at_pickup: `${cap(w)} has arrived`,
    in_trip: 'On trip',
    done: 'You have arrived',
    cancelled: 'Trip cancelled',
  }[phase];
}

function view(b) {
  const now = Date.now();
  const { phase, f } = phaseOf(b, now);
  const speed = speedFor(b.vehicle.id, b.routes.trip.km);
  let driverPosition = null;
  let etaMin = null;
  if (phase === 'scheduled') driverPosition = null;
  if (phase === 'to_pickup') {
    driverPosition = pointAlong(b.routes.toPickup.points, f);
    etaMin = Math.max(1, Math.ceil(((b.routes.toPickup.km * (1 - f)) / speed) * 60));
  } else if (phase === 'at_pickup') {
    driverPosition = [b.pickup.lat, b.pickup.lng];
    etaMin = Math.max(1, Math.ceil((b.routes.trip.km / speed) * 60));
  } else if (phase === 'in_trip') {
    driverPosition = pointAlong(b.routes.trip.points, f);
    etaMin = Math.max(1, Math.ceil(((b.routes.trip.km * (1 - f)) / speed) * 60));
  } else if (phase === 'done') {
    driverPosition = [b.dropoff.lat, b.dropoff.lng];
  }
  return {
    id: b.id,
    service: b.service.id,
    vehicle: b.vehicle.id,
    tier: b.tier.id,
    pickup: b.pickup,
    dropoff: b.dropoff,
    size: b.size,
    schedule: b.schedule,
    airport: b.airport,
    delivery: b.delivery,
    payment: b.payment,
    quote: b.quote,
    phase,
    progress: f ?? null,
    statusLabel: labelFor(b, phase),
    driver: phase === 'searching' ? null : b.driver,
    driverPosition,
    etaMin,
    routes: { toPickup: b.routes.toPickup.points, trip: b.routes.trip.points },
    messages: b.messages.filter((m) => m.at <= now).map(({ from, text, at }) => ({ from, text, at })),
    rating: b.rating,
    createdAt: b.createdAt,
  };
}

export function startBooking(id) {
  const b = bookings.get(id);
  if (!b) return null;
  if (!b.startAt && !b.cancelledAt) b.startAt = Math.max(Date.now(), b.matchedAt);
  return view(b);
}

export function cancelBooking(id) {
  const b = bookings.get(id);
  if (!b) return null;
  const { phase } = phaseOf(b, Date.now());
  if (phase === 'done') throw new Error('This trip is already finished');
  b.cancelledAt = Date.now();
  return view(b);
}

export function rateBooking(id, stars) {
  const b = bookings.get(id);
  if (!b) return null;
  b.rating = stars;
  return view(b);
}

export function addMessage(id, text) {
  const b = bookings.get(id);
  if (!b) return null;
  const now = Date.now();
  b.messages.push({ from: 'me', text, at: now });
  const current = view(b);
  b.messages.push({ from: 'driver', text: replyTo(text, b, current), at: now + 1800 + Math.random() * 1500 });
  return view(b);
}

function replyTo(text, b, current) {
  const t = text.toLowerCase();
  if (/where|how long|far|eta/.test(t)) {
    if (current.phase === 'to_pickup') return `I'm about ${current.etaMin} min away from ${b.pickup.name}.`;
    if (current.phase === 'in_trip') return `We're about ${current.etaMin} min from ${b.dropoff.name}.`;
    if (current.phase === 'at_pickup') return `I'm already at ${b.pickup.name}.`;
  }
  if (/gate|stage|wait|here|outside/.test(t)) return "Okay, no problem. I'll find you there.";
  if (/call/.test(t)) return 'Sure, you can call me anytime 📞';
  if (/care|fragile|careful/.test(t)) return "Don't worry, I'll handle it with care.";
  if (/thank|webale/.test(t)) return 'You are welcome! 🙏';
  const generic = ['Okay 👍', 'Noted, thank you!', "Sawa, I'm coming."];
  return generic[Math.floor(Math.random() * generic.length)];
}
