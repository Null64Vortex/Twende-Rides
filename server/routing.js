import { haversineKm } from './places.js';

const cache = new Map();

// Road route from the free OSRM demo server, falling back to a gentle curve when offline.
export async function route(a, b) {
  const key = `${a.lat},${a.lng};${b.lat},${b.lng}`;
  if (cache.has(key)) return cache.get(key);
  let result = null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 3500);
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${a.lng},${a.lat};${b.lng},${b.lat}?overview=full&geometries=geojson`;
    const res = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': 'twende-ride-app' } });
    const json = await res.json();
    const r = json.routes?.[0];
    if (r?.geometry?.coordinates?.length > 1) {
      result = { points: r.geometry.coordinates.map(([lng, lat]) => [lat, lng]), km: r.distance / 1000 };
    }
  } catch {
    // offline or rate-limited: use fallback
  } finally {
    clearTimeout(timer);
  }
  if (!result) result = curve(a, b);
  cache.set(key, result);
  return result;
}

function curve(a, b, steps = 24) {
  const dLat = b.lat - a.lat;
  const dLng = b.lng - a.lng;
  const points = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const bend = Math.sin(Math.PI * t) * 0.08;
    points.push([a.lat + dLat * t - dLng * bend, a.lng + dLng * t + dLat * bend]);
  }
  return { points, km: haversineKm(a, b) * 1.3 };
}

// Point at fraction f (0..1) of the polyline's length.
export function pointAlong(points, f) {
  if (points.length === 1 || f <= 0) return points[0];
  if (f >= 1) return points[points.length - 1];
  const seg = [];
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const d = haversineKm({ lat: points[i - 1][0], lng: points[i - 1][1] }, { lat: points[i][0], lng: points[i][1] });
    seg.push(d);
    total += d;
  }
  let target = total * f;
  for (let i = 0; i < seg.length; i++) {
    if (target <= seg[i]) {
      const t = seg[i] === 0 ? 0 : target / seg[i];
      const [la1, ln1] = points[i];
      const [la2, ln2] = points[i + 1];
      return [la1 + (la2 - la1) * t, ln1 + (ln2 - ln1) * t];
    }
    target -= seg[i];
  }
  return points[points.length - 1];
}

export function offsetPoint(p, km) {
  const angle = Math.random() * Math.PI * 2;
  const dLat = (km / 111) * Math.cos(angle);
  const dLng = (km / (111 * Math.cos((p.lat * Math.PI) / 180))) * Math.sin(angle);
  return { lat: p.lat + dLat, lng: p.lng + dLng };
}
