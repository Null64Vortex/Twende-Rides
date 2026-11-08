import crypto from 'node:crypto';
import { route } from './routing.js';
import { haversineKm } from './places.js';
import { etaMinutes, ROAD_FACTOR } from './catalog.js';
import { getDriver, nearestAvailable, publicDriver } from './drivers.js';

// How long each driver has to answer, and how long we keep searching.
const OFFER_MS = 30_000;
const SEARCH_TIMEOUT_MS = 120_000;
const MAX_KM = { boda: 10, car: 20, van: 25 };

// Status flow:
// searching -> accepted (driver calls client to agree on price) -> to_pickup (client confirmed; location shared)
// -> arrived -> in_trip -> done.   Also: no_drivers, cancelled.
const REVEALED = ['to_pickup', 'arrived', 'in_trip', 'done'];

export class BookingError extends Error {}
const fail = (m) => { throw new BookingError(m); };

const bookings = new Map();
const hex = (n) => crypto.randomBytes(n).toString('hex');
const first = (name) => name.split(' ')[0];
const word = (b) => (b.vehicle.id === 'boda' ? 'rider' : 'driver');
const round1 = (n) => Math.round(n * 10) / 10;

export function createBooking(data) {
  let id;
  do { id = hex(3).toUpperCase(); } while (bookings.has(id));
  const now = Date.now();
  const b = {
    id,
    token: hex(16),
    ...data,
    status: 'searching',
    searchStartedAt: now,
    offer: null,
    declined: new Set(),
    driverId: null,
    clientPos: data.pickup.gps ? { lat: data.pickup.lat, lng: data.pickup.lng } : null,
    tripRoute: null,
    messages: [],
    rating: null,
    createdAt: now,
  };
  bookings.set(id, b);
  route(data.pickup, data.dropoff).then((r) => { b.tripRoute = r; }).catch(() => {});
  dispatch(b);
  return b;
}

export function getClientBooking(id, token) {
  const b = bookings.get(id);
  return b && b.token === token ? b : null;
}

// Offer the booking to the nearest free driver; move on when they decline or time out.
function dispatch(b) {
  if (b.status !== 'searching') return;
  const now = Date.now();
  if (b.offer) {
    const d = getDriver(b.offer.driverId);
    if (now < b.offer.expiresAt && d?.online) return;
    b.declined.add(b.offer.driverId);
    clearOffer(b);
  }
  const d = nearestAvailable(b.vehicle.id, b.pickup, MAX_KM[b.vehicle.id], b.declined);
  if (d) {
    b.offer = { driverId: d.id, expiresAt: now + OFFER_MS };
    d.offerBookingId = b.id;
    return;
  }
  if (now - b.searchStartedAt > SEARCH_TIMEOUT_MS) b.status = 'no_drivers';
}

function clearOffer(b) {
  if (!b.offer) return;
  const d = getDriver(b.offer.driverId);
  if (d && d.offerBookingId === b.id) d.offerBookingId = null;
  b.offer = null;
}

setInterval(() => { for (const b of bookings.values()) dispatch(b); }, 1000);

const system = (b, text) => b.messages.push({ from: 'system', text, at: Date.now() });

function releaseDriver(b, reason) {
  const d = getDriver(b.driverId);
  if (d && d.jobId === b.id) d.jobId = null;
  if (b.driverId) b.declined.add(b.driverId);
  b.driverId = null;
  b.status = 'searching';
  b.searchStartedAt = Date.now();
  system(b, reason);
  dispatch(b);
}

/* ---------------- Client actions ---------------- */

export function clientAgree(b) {
  if (b.status !== 'accepted') fail('There is no driver waiting for your confirmation');
  b.status = 'to_pickup';
  b.agreedAt = Date.now();
  system(b, 'Price agreed. Your location is now shared with your driver.');
}

export function clientNotAgreed(b) {
  if (b.status !== 'accepted') fail('Nothing to change');
  const d = getDriver(b.driverId);
  releaseDriver(b, `You and ${d ? first(d.name) : 'the driver'} didn't agree. Finding another ${word(b)}...`);
}

export function clientRetry(b) {
  if (b.status !== 'no_drivers') fail('Already searching');
  b.status = 'searching';
  b.searchStartedAt = Date.now();
  b.declined.clear();
  dispatch(b);
}

export function clientCancel(b) {
  if (b.status === 'done' || b.status === 'cancelled') fail('This booking is already finished');
  clearOffer(b);
  const d = getDriver(b.driverId);
  if (d && d.jobId === b.id) d.jobId = null;
  b.status = 'cancelled';
  system(b, 'Booking cancelled by the client.');
}

export function clientLocation(b, { lat, lng }) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) fail('Bad location');
  b.clientPos = { lat, lng };
}

export function clientRate(b, stars) {
  if (b.status !== 'done') fail('You can rate after the trip');
  if (b.rating) return;
  b.rating = stars;
  getDriver(b.driverId)?.ratings.push(stars);
}

export function addMessage(b, from, text) {
  if (!['accepted', ...REVEALED].includes(b.status)) fail('Chat opens once a driver accepts');
  b.messages.push({ from, text, at: Date.now() });
}

/* ---------------- Driver actions ---------------- */

export function driverRespond(d, bookingId, accept) {
  const b = bookings.get(bookingId);
  if (!b || b.status !== 'searching' || b.offer?.driverId !== d.id) fail('This request is no longer available');
  clearOffer(b);
  if (accept) {
    b.status = 'accepted';
    b.driverId = d.id;
    b.acceptedAt = Date.now();
    d.jobId = b.id;
    system(b, `${first(d.name)} accepted and will call you to agree on the price.`);
  } else {
    b.declined.add(d.id);
    dispatch(b);
  }
}

export const driverJob = (d) => (d.jobId ? bookings.get(d.jobId) || null : null);
export const driverOffer = (d) => (d.offerBookingId ? bookings.get(d.offerBookingId) || null : null);

const NEXT = { arrived: ['to_pickup', 'arrived'], start: ['arrived', 'in_trip'], complete: ['in_trip', 'done'] };

export function driverAdvance(d, action) {
  const b = driverJob(d);
  if (!b) fail('You have no active trip');
  if (action === 'release') {
    releaseDriver(b, `${first(d.name)} can't take this trip. Finding another ${word(b)}...`);
    return;
  }
  const step = NEXT[action];
  if (!step) fail('Unknown action');
  if (b.status !== step[0]) fail('That step is not available right now');
  b.status = step[1];
  if (b.status === 'done') {
    d.jobId = null;
    b.doneAt = Date.now();
  }
}

/* ---------------- Views ---------------- */

const placeView = (p) => ({ id: p.id, name: p.name, area: p.area, lat: p.lat, lng: p.lng, gps: !!p.gps });

function etaFor(b, d) {
  if (!d?.pos) return null;
  if (['accepted', 'to_pickup'].includes(b.status)) return etaMinutes(b.vehicle.id, haversineKm(d.pos, b.clientPos || b.pickup));
  if (b.status === 'in_trip') return etaMinutes(b.vehicle.id, haversineKm(d.pos, b.dropoff));
  return null;
}

function shared(b) {
  return {
    id: b.id,
    status: b.status,
    service: b.service.id,
    vehicle: b.vehicle.id,
    tier: b.tier.id,
    size: b.size,
    schedule: b.schedule,
    airport: b.airport,
    payment: b.payment,
    dropoff: placeView(b.dropoff),
    tripKm: round1(haversineKm(b.pickup, b.dropoff) * ROAD_FACTOR),
    messages: b.messages,
  };
}

export function clientView(b) {
  const d = b.driverId ? getDriver(b.driverId) : null;
  return {
    ...shared(b),
    pickup: placeView(b.pickup),
    clientPos: b.clientPos ? [b.clientPos.lat, b.clientPos.lng] : null,
    client: b.client,
    delivery: b.delivery,
    driver: d ? publicDriver(d) : null,
    etaMin: etaFor(b, d),
    tripRoute: b.tripRoute?.points || null,
    rating: b.rating,
    searchingSec: b.status === 'searching' ? Math.round((Date.now() - b.searchStartedAt) / 1000) : null,
  };
}

// The driver only learns where the client is after the client confirms the price agreement.
export function driverView(b, d) {
  const revealed = REVEALED.includes(b.status) && b.driverId === d.id;
  const isOffer = b.status === 'searching';
  const target = b.clientPos || b.pickup;
  return {
    ...shared(b),
    messages: isOffer ? [] : b.messages,
    revealed,
    client: {
      name: isOffer ? first(b.client.name) : b.client.name,
      phone: isOffer ? null : b.client.phone,
    },
    contents: b.delivery?.contents || null,
    receiver: revealed ? b.delivery?.receiver || null : null,
    pickupKm: d.pos ? round1(haversineKm(d.pos, b.pickup)) : null,
    pickup: revealed ? placeView(b.pickup) : null,
    clientPos: revealed ? [target.lat, target.lng] : null,
    tripRoute: revealed ? b.tripRoute?.points || null : null,
    etaMin: revealed ? etaFor(b, d) : null,
    offerExpiresInMs: isOffer && b.offer ? Math.max(0, b.offer.expiresAt - Date.now()) : null,
  };
}
