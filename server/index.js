import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SERVICES, VEHICLES, TIERS, CONTENTS, SIZES, PAYMENTS, quote } from './catalog.js';
import { findPlace, searchPlaces } from './places.js';
import { route } from './routing.js';
import { createBooking, getBooking, startBooking, cancelBooking, rateBooking, addMessage } from './bookings.js';

const PORT = process.env.PORT || 4000;
const app = express();
app.use(cors());
app.use(express.json({ limit: '50kb' }));

class BadRequest extends Error {}
const bad = (msg) => new BadRequest(msg);
const cleanPhone = (p) => String(p || '').replace(/[\s-]/g, '');
const validPhone = (p) => /^(?:\+?256|0)7\d{8}$/.test(cleanPhone(p));
const text = (v, max = 80) => String(v || '').trim().slice(0, max);

function parseCore(body) {
  const service = SERVICES.find((s) => s.id === body.service);
  const vehicle = VEHICLES.find((v) => v.id === body.vehicle);
  const tier = TIERS.find((t) => t.id === body.tier);
  if (!service) throw bad('Choose a service');
  if (!vehicle) throw bad('Choose a vehicle');
  if (!tier) throw bad('Choose a class');
  const pickup = findPlace(body.pickupId);
  const dropoff = findPlace(body.dropoffId);
  if (!pickup || !dropoff) throw bad('Choose pickup and drop-off');
  if (pickup.id === dropoff.id) throw bad('Pickup and drop-off must be different');
  let size = null;
  if (service.id === 'delivery') {
    size = body.size || 'small';
    if (!SIZES.some((s) => s.id === size)) throw bad('Choose a package size');
    if (!vehicle.sizes.includes(size)) throw bad(`A ${vehicle.name} can't carry a ${size} package`);
  }
  return { service, vehicle, tier, pickup, dropoff, size };
}

function parseBooking(body) {
  const core = parseCore(body);
  const schedule = { mode: 'now', at: null };
  if (core.service.id !== 'delivery' && body.schedule?.mode === 'later') {
    const at = new Date(body.schedule.at);
    if (Number.isNaN(at.getTime()) || at.getTime() < Date.now() + 5 * 60000) throw bad('Pick a time in the future');
    schedule.mode = 'later';
    schedule.at = at.toISOString();
  }
  let delivery = null;
  if (core.service.id === 'delivery') {
    const d = body.delivery || {};
    const person = (p, who) => {
      if (!text(p?.name)) throw bad(`Enter the ${who}'s name`);
      if (!validPhone(p?.phone)) throw bad(`Enter a valid phone number for the ${who}`);
      return { name: text(p.name), phone: cleanPhone(p.phone) };
    };
    if (!CONTENTS.some((c) => c.id === d.contents)) throw bad("Tell us what's inside");
    delivery = { sender: person(d.sender, 'sender'), receiver: person(d.receiver, 'receiver'), contents: d.contents };
  }
  let airport = null;
  if (core.service.id === 'airport') {
    const direction = body.airport?.direction === 'from' ? 'from' : 'to';
    const airportSide = direction === 'to' ? core.dropoff : core.pickup;
    if (airportSide.id !== 'ebb') throw bad('Airport trips must start or end at Entebbe Airport');
    airport = { direction, flight: text(body.airport?.flight, 12).toUpperCase() || null };
  }
  const method = PAYMENTS.some((p) => p.id === body.payment?.method) ? body.payment.method : 'cash';
  if (method === 'momo' && !validPhone(body.payment?.phone)) throw bad('Enter your Mobile Money number');
  const payment = { method, phone: method === 'momo' ? cleanPhone(body.payment.phone) : null };
  return { ...core, schedule, delivery, airport, payment, quote: quote(core) };
}

const wrap = (fn) => async (req, res) => {
  try {
    const out = await fn(req, res);
    if (out === null) return res.status(404).json({ error: 'Booking not found' });
    res.json(out);
  } catch (e) {
    const status = e instanceof BadRequest ? 400 : 500;
    if (status === 500) console.error(e);
    res.status(status).json({ error: status === 400 ? e.message : e.message || 'Server error' });
  }
};

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.get('/api/catalog', (req, res) =>
  res.json({ services: SERVICES, vehicles: VEHICLES, tiers: TIERS, contents: CONTENTS, sizes: SIZES, payments: PAYMENTS }));
app.get('/api/places', (req, res) => res.json(searchPlaces(req.query.q)));
app.get('/api/route', wrap(async (req) => {
  const a = findPlace(req.query.from);
  const b = findPlace(req.query.to);
  if (!a || !b) throw bad('Unknown place');
  return route(a, b);
}));
app.post('/api/quote', wrap((req) => quote(parseCore(req.body))));
app.post('/api/bookings', wrap((req) => createBooking(parseBooking(req.body))));
app.get('/api/bookings/:id', wrap((req) => getBooking(req.params.id)));
app.post('/api/bookings/:id/start', wrap((req) => startBooking(req.params.id)));
app.post('/api/bookings/:id/cancel', wrap((req) => {
  try { return cancelBooking(req.params.id); } catch (e) { throw bad(e.message); }
}));
app.post('/api/bookings/:id/rating', wrap((req) => {
  const stars = Number(req.body.stars);
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) throw bad('Rating must be 1 to 5 stars');
  return rateBooking(req.params.id, stars);
}));
app.post('/api/bookings/:id/messages', wrap((req) => {
  const t = text(req.body.text, 300);
  if (!t) throw bad('Message is empty');
  return addMessage(req.params.id, t);
}));

// Serve the built React app in production.
const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'client', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get('*', (req, res, next) => (req.path.startsWith('/api') ? next() : res.sendFile(path.join(dist, 'index.html'))));
}

app.listen(PORT, () => console.log(`Twende API running on http://localhost:${PORT}`));
