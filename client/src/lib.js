export const fmtUGX = (n) => `${Math.round(n).toLocaleString('en-US')} UGX`;

export function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export const initials = (name) => name.split(' ').map((s) => s[0]).slice(0, 2).join('').toUpperCase();

const GRADIENTS = [
  ['#FFB800', '#FF7A00'],
  ['#3FB984', '#1E7F5C'],
  ['#5B8DEF', '#3451C7'],
  ['#E2557A', '#A3244A'],
  ['#9B6BEF', '#5B32B4'],
];
export function gradientFor(s) {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const [a, b] = GRADIENTS[h % GRADIENTS.length];
  return `linear-gradient(135deg, ${a}, ${b})`;
}

export const personWord = (vehicle) => (vehicle === 'boda' ? 'rider' : 'driver');
export const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

export const validPhone = (p) => /^(?:\+?256|0)7\d{8}$/.test(String(p || '').replace(/[\s-]/g, ''));

export function fmtDateTime(iso) {
  const d = new Date(iso);
  return d.toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

// Value for <input type="datetime-local"> N minutes from now, in local time.
export function localDateTime(minutesAhead = 0) {
  const d = new Date(Date.now() + minutesAhead * 60000);
  d.setSeconds(0, 0);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export function tierInfo(tier, service, vehicle) {
  if (service === 'delivery') return tier.delivery;
  const { summary, perks } = { ...tier.travel, ...(tier.travel[vehicle] || {}) };
  return { summary, perks };
}
