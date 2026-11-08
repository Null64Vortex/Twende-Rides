import { useEffect, useRef, useState } from 'react';

// Live GPS position. `enabled` turns the watch on and off.
export function useGeolocation(enabled = true) {
  const [state, setState] = useState({ pos: null, error: null });
  useEffect(() => {
    if (!enabled) return undefined;
    if (!('geolocation' in navigator)) {
      setState({ pos: null, error: 'This device has no GPS' });
      return undefined;
    }
    const id = navigator.geolocation.watchPosition(
      (p) => setState({ pos: { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }, error: null }),
      (e) => setState((s) => ({
        ...s,
        error: e.code === 1 ? 'Location is blocked. Allow location for this site in your browser settings.' : 'Could not get your location',
      })),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [enabled]);
  return state;
}

// Sends position updates at most every `ms` milliseconds.
export function useLocationSender(pos, send, ms = 4000) {
  const last = useRef(0);
  const sendRef = useRef(send);
  sendRef.current = send;
  useEffect(() => {
    if (!pos || !sendRef.current) return;
    const now = Date.now();
    if (now - last.current < ms) return;
    last.current = now;
    sendRef.current(pos).catch(() => {});
  }, [pos, ms]);
}

export const gpsPlace = (pos) => ({
  id: 'gps',
  gps: true,
  name: 'Current location',
  area: `GPS · accurate to ${Math.max(5, Math.round(pos.accuracy || 0))} m`,
  lat: pos.lat,
  lng: pos.lng,
});

export const mapsLink = (lat, lng) => `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;

// Keep the screen on while a driver is online (supported on most Android browsers).
export async function keepAwake() {
  try { return await navigator.wakeLock?.request('screen'); } catch { return null; }
}

let audio;
export function unlockAudio() {
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    audio.resume();
  } catch { /* no audio */ }
}

export function ring() {
  navigator.vibrate?.([300, 150, 300, 150, 300]);
  if (!audio) return;
  const t0 = audio.currentTime;
  [0, 0.22, 0.44].forEach((t) => {
    const o = audio.createOscillator();
    const g = audio.createGain();
    o.frequency.value = 880;
    o.connect(g);
    g.connect(audio.destination);
    g.gain.setValueAtTime(0.0001, t0 + t);
    g.gain.exponentialRampToValueAtTime(0.5, t0 + t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + t + 0.18);
    o.start(t0 + t);
    o.stop(t0 + t + 0.2);
  });
}
