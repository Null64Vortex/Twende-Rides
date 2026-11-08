import crypto from 'node:crypto';
import { haversineKm } from './places.js';

// Registered drivers, kept in memory. Drivers keep their id/token on their phone,
// so after a server restart the driver app re-registers itself automatically.
const drivers = new Map();

// A driver whose GPS hasn't reported for this long is treated as unavailable.
export const STALE_MS = 90_000;

const VEHICLE_IDS = ['boda', 'car', 'van'];
const IMAGE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;
const MAX_IMAGE = 300_000;

export class DriverInputError extends Error {}
const fail = (m) => { throw new DriverInputError(m); };

export const cleanPhone = (p) => String(p || '').replace(/[\s-]/g, '');
export const validPhone = (p) => /^(?:\+?256|0)7\d{8}$/.test(cleanPhone(p));
const str = (v, max) => String(v || '').trim().slice(0, max);
const hex = (bytes) => crypto.randomBytes(bytes).toString('hex');

function parseProfile(p = {}) {
  const profile = {
    name: str(p.name, 60),
    phone: cleanPhone(p.phone),
    vehicle: p.vehicle,
    model: str(p.model, 40),
    plate: str(p.plate, 12).toUpperCase(),
    color: str(p.color, 20),
    photo: typeof p.photo === 'string' ? p.photo : '',
    vehiclePhoto: typeof p.vehiclePhoto === 'string' && p.vehiclePhoto ? p.vehiclePhoto : null,
  };
  if (profile.name.length < 2) fail('Enter your full name');
  if (!validPhone(profile.phone)) fail('Enter a valid phone number, e.g. 0772 123456');
  if (!VEHICLE_IDS.includes(profile.vehicle)) fail('Choose your vehicle type');
  if (profile.model.length < 2) fail('Enter your vehicle model, e.g. Bajaj Boxer');
  if (!/^[A-Z0-9 ]{4,12}$/.test(profile.plate)) fail('Enter your number plate, e.g. UEX 452K');
  if (!IMAGE.test(profile.photo) || profile.photo.length > MAX_IMAGE) fail('Add a clear photo of yourself');
  if (profile.vehiclePhoto && (!IMAGE.test(profile.vehiclePhoto) || profile.vehiclePhoto.length > MAX_IMAGE)) fail('That vehicle photo could not be used');
  return profile;
}

export function registerDriver({ id, token, profile }) {
  const data = parseProfile(profile);
  let d = typeof id === 'string' ? drivers.get(id) : null;
  if (d && !safeEqual(d.token, token)) fail('This driver account belongs to another phone');
  if (!d) {
    // Re-use the phone's saved id/token after a server restart; otherwise create new ones.
    const reuse = /^[a-f0-9]{16}$/.test(id || '') && /^[a-f0-9]{48}$/.test(token || '');
    d = {
      id: reuse ? id : hex(8),
      token: reuse ? token : hex(24),
      online: false,
      pos: null,
      updatedAt: 0,
      offerBookingId: null,
      jobId: null,
      ratings: [],
    };
    drivers.set(d.id, d);
  }
  Object.assign(d, data);
  return d;
}

function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export function authDriver(id, token) {
  const d = drivers.get(id);
  return d && safeEqual(d.token, token) ? d : null;
}

export const getDriver = (id) => drivers.get(id) || null;

export function setDriverLocation(d, { lat, lng, accuracy }) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) fail('Bad location');
  d.pos = { lat, lng, accuracy: Number.isFinite(accuracy) ? Math.round(accuracy) : null };
  d.updatedAt = Date.now();
}

export function isAvailable(d, now = Date.now()) {
  return d.online && d.pos && now - d.updatedAt < STALE_MS && !d.jobId && !d.offerBookingId;
}

export function nearestAvailable(vehicleId, point, maxKm, exclude) {
  const now = Date.now();
  return [...drivers.values()]
    .filter((d) => d.vehicle === vehicleId && !exclude.has(d.id) && isAvailable(d, now))
    .map((d) => ({ d, km: haversineKm(d.pos, point) }))
    .filter((x) => x.km <= maxKm)
    .sort((a, b) => a.km - b.km)[0]?.d || null;
}

export function nearbyCounts(point, maxKm = 15) {
  const now = Date.now();
  const counts = { boda: 0, car: 0, van: 0 };
  for (const d of drivers.values()) {
    if (d.online && d.pos && now - d.updatedAt < STALE_MS && haversineKm(d.pos, point) <= maxKm) counts[d.vehicle] += 1;
  }
  return counts;
}

export function rating(d) {
  if (!d.ratings.length) return { rating: null, ratingCount: 0 };
  const avg = d.ratings.reduce((a, b) => a + b, 0) / d.ratings.length;
  return { rating: Math.round(avg * 10) / 10, ratingCount: d.ratings.length };
}

// What a client sees about their driver.
export function publicDriver(d) {
  return {
    id: d.id,
    name: d.name,
    phone: d.phone,
    photo: d.photo,
    vehiclePhoto: d.vehiclePhoto,
    vehicle: d.vehicle,
    model: d.model,
    plate: d.plate,
    color: d.color,
    ...rating(d),
    position: d.pos ? [d.pos.lat, d.pos.lng] : null,
  };
}

export function selfView(d) {
  return { ...publicDriver(d), online: d.online, gpsFresh: !!d.pos && Date.now() - d.updatedAt < STALE_MS };
}
