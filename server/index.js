import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SERVICES, VEHICLES, TIERS, CONTENTS, SIZES, PAYMENTS } from './catalog.js';
import { findPlace, searchPlaces } from './places.js';
import { route } from './routing.js';
import {
  DriverInputError, authDriver, cleanPhone, nearbyCounts, registerDriver, selfView, setDriverLocation, setOnline, validPhone,
} from './drivers.js';
import {
  BookingError, addMessage, clientCancel, clientLocation, clientNotAgreed, clientRate, clientRetry,
  clientView, createBooking, driverAdvance, driverJob, driverOffer, driverRespond, driverStats, driverView, getClientBooking,
} from './bookings.js';

const PORT = process.env.PORT || 4000;
const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

class BadRequest extends Error {}
class NotFound extends Error {}
class Unauthorized extends Error {}
const bad = (msg) => new BadRequest(msg);
const text = (v, max = 80) => String(v || '').trim().slice(0, max);
const num = (v) => (typeof v === 'number' ? v : Number.parseFloat(v));

// Uganda, roughly. Keeps junk coordinates out.
const inUganda = (lat, lng) => lat > -1.6 && lat < 4.4 && lng > 29.4 && lng < 35.2;

function parsePickup(body) {
  if (body.pickupGps) {
    const lat = num(body.pickupGps.lat);
    const lng = num(body.pickupGps.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw bad('Your location could not be read');
    if (!inUganda(lat, lng)) throw bad('Twende Ride App currently works in Uganda only');
    return { id: 'gps', name: 'Current location', area: 'Shared from GPS', lat, lng, gps: true };
  }
  const p = findPlace(body.pickupId);
  if (!p) throw bad('Choose a pickup location');
  return p;
}

function parseBooking(body) {
  const service = SERVICES.find((s) => s.id === body.service);
  const vehicle = VEHICLES.find((v) => v.id === body.vehicle);
  const tier = TIERS.find((t) => t.id === body.tier);
  if (!service) throw bad('Choose a service');
  if (!vehicle) throw bad('Choose a vehicle');
  if (!tier) throw bad('Choose a class');
  const pickup = parsePickup(body);
  const dropoff = findPlace(body.dropoffId);
  if (!dropoff) throw bad('Choose where you are going');
  if (pickup.id === dropoff.id) throw bad('Pickup and drop-off must be different');

  const client = { name: text(body.client?.name, 60), phone: cleanPhone(body.client?.phone) };
  if (client.name.length < 2) throw bad('Enter your name');
  if (!validPhone(client.phone)) throw bad('Enter a valid phone number so your driver can call you');

  let size = null;
  let delivery = null;
  if (service.id === 'delivery') {
    size = body.size || 'small';
    if (!SIZES.some((s) => s.id === size)) throw bad('Choose a package size');
    if (!vehicle.sizes.includes(size)) throw bad(`A ${vehicle.name} can't carry a ${size} package`);
    const r = body.delivery?.receiver || {};
    if (!text(r.name)) throw bad("Enter the receiver's name");
    if (!validPhone(r.phone)) throw bad("Enter a valid phone number for the receiver");
    if (!CONTENTS.some((c) => c.id === body.delivery?.contents)) throw bad("Tell us what's inside");
    delivery = { receiver: { name: text(r.name), phone: cleanPhone(r.phone) }, contents: body.delivery.contents };
  }

  const schedule = { mode: 'now', at: null };
  if (service.id !== 'delivery' && body.schedule?.mode === 'later') {
    const at = new Date(body.schedule.at);
    if (Number.isNaN(at.getTime()) || at.getTime() < Date.now() + 5 * 60000) throw bad('Pick a time in the future');
    schedule.mode = 'later';
    schedule.at = at.toISOString();
  }

  let airport = null;
  if (service.id === 'airport') {
    const direction = body.airport?.direction === 'from' ? 'from' : 'to';
    const airportSide = direction === 'to' ? dropoff : pickup;
    if (airportSide.id !== 'ebb') throw bad('Airport trips must start or end at Entebbe Airport');
    airport = { direction, flight: text(body.airport?.flight, 12).toUpperCase() || null };
  }

  const payment = { method: PAYMENTS.some((p) => p.id === body.payment?.method) ? body.payment.method : 'cash' };
  return { service, vehicle, tier, pickup, dropoff, size, client, delivery, schedule, airport, payment };
}

const wrap = (fn) => async (req, res) => {
  try {
    res.json(await fn(req, res));
  } catch (e) {
    if (e instanceof BadRequest || e instanceof BookingError || e instanceof DriverInputError) return res.status(400).json({ error: e.message });
    if (e instanceof NotFound) return res.status(404).json({ error: e.message });
    if (e instanceof Unauthorized) return res.status(401).json({ error: e.message });
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
};

function clientBooking(req) {
  const b = getClientBooking(req.params.id, req.get('x-booking-token'));
  if (!b) throw new NotFound('Booking not found');
  return b;
}

function driverAuth(req) {
  const d = authDriver(req.get('x-driver-id'), req.get('x-driver-token'));
  if (!d) throw new Unauthorized('Please sign in again');
  return d;
}

function driverState(d) {
  const offer = driverOffer(d);
  const job = driverJob(d);
  return { driver: selfView(d), stats: driverStats(d), offer: offer ? driverView(offer, d) : null, job: job ? driverView(job, d) : null };
}

function parseLatLng(s) {
  const [lat, lng] = String(s || '').split(',').map(Number);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw bad('Bad coordinates');
  return { lat, lng };
}

/* ---------- Public ---------- */
app.get('/api/health', (req, res) => res.json({ ok: true }));
app.get('/api/catalog', (req, res) =>
  res.json({ services: SERVICES, vehicles: VEHICLES, tiers: TIERS, contents: CONTENTS, sizes: SIZES, payments: PAYMENTS }));
app.get('/api/places', (req, res) => res.json(searchPlaces(req.query.q)));
app.get('/api/route', wrap(async (req) => route(parseLatLng(req.query.a), parseLatLng(req.query.b))));
app.get('/api/drivers/nearby', wrap((req) => nearbyCounts(parseLatLng(req.query.at))));

/* ---------- Client ---------- */
app.post('/api/bookings', wrap((req) => {
  const b = createBooking(parseBooking(req.body));
  return { token: b.token, booking: clientView(b) };
}));
app.get('/api/bookings/:id', wrap((req) => clientView(clientBooking(req))));
const clientAction = (name, fn) => app.post(`/api/bookings/:id/${name}`, wrap((req) => {
  const b = clientBooking(req);
  fn(b, req.body || {});
  return clientView(b);
}));
clientAction('not-agreed', (b) => clientNotAgreed(b));
clientAction('retry', (b) => clientRetry(b));
clientAction('cancel', (b) => clientCancel(b));
clientAction('location', (b, body) => clientLocation(b, { lat: num(body.lat), lng: num(body.lng) }));
clientAction('messages', (b, body) => {
  const t = text(body.text, 300);
  if (!t) throw bad('Message is empty');
  addMessage(b, 'client', t);
});
clientAction('rating', (b, body) => {
  const stars = Number(body.stars);
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) throw bad('Rating must be 1 to 5 stars');
  clientRate(b, stars);
});

/* ---------- Driver ---------- */
app.post('/api/drivers', wrap((req) => {
  const d = registerDriver(req.body || {});
  return { id: d.id, token: d.token, driver: selfView(d) };
}));
app.get('/api/driver/me', wrap((req) => driverState(driverAuth(req))));
app.post('/api/driver/status', wrap((req) => {
  const d = driverAuth(req);
  if (!req.body.online && d.jobId) throw bad('Finish or release your current trip first');
  setOnline(d, !!req.body.online);
  return driverState(d);
}));
app.post('/api/driver/location', wrap((req) => {
  const d = driverAuth(req);
  setDriverLocation(d, { lat: num(req.body.lat), lng: num(req.body.lng), accuracy: num(req.body.accuracy) });
  return { ok: true };
}));
app.post('/api/driver/offer/:bookingId/:answer(accept|decline)', wrap((req) => {
  const d = driverAuth(req);
  driverRespond(d, req.params.bookingId, req.params.answer === 'accept');
  return driverState(d);
}));
app.post('/api/driver/job/messages', wrap((req) => {
  const d = driverAuth(req);
  const job = driverJob(d);
  if (!job) throw bad('You have no active trip');
  const t = text(req.body.text, 300);
  if (!t) throw bad('Message is empty');
  addMessage(job, 'driver', t);
  return driverState(d);
}));
app.post('/api/driver/job/:action(agree|arrived|start|complete|release)', wrap((req) => {
  const d = driverAuth(req);
  driverAdvance(d, req.params.action);
  return driverState(d);
}));

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

// Serve the built React app in production.
const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'client', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get('*', (req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.listen(PORT, () => console.log(`Twende Ride App API running on http://localhost:${PORT}`));
