// Places around Kampala / Wakiso / Entebbe (approximate coordinates).
export const PLACES = [
  { id: 'kasangati', name: 'Kasangati', area: 'Wakiso · Gayaza Road', lat: 0.4436, lng: 32.6036 },
  { id: 'ebb', name: 'Entebbe Airport', area: 'Entebbe International Airport (EBB)', lat: 0.0424, lng: 32.4435, emoji: '✈️' },
  { id: 'ntinda', name: 'Ntinda', area: 'Nakawa Division', lat: 0.3546, lng: 32.6146 },
  { id: 'cbd', name: 'Kampala City Centre', area: 'City Square · Central', lat: 0.3136, lng: 32.5811, emoji: '🏙️' },
  { id: 'old-taxi-park', name: 'Old Taxi Park', area: 'Central Division', lat: 0.3132, lng: 32.5756, emoji: '🚌' },
  { id: 'acacia', name: 'Acacia Mall', area: 'Kisementi · Kololo', lat: 0.3365, lng: 32.5885, emoji: '🛍️' },
  { id: 'garden-city', name: 'Garden City Mall', area: 'Yusuf Lule Road · Central', lat: 0.3196, lng: 32.5915, emoji: '🛍️' },
  { id: 'kololo', name: 'Kololo', area: 'Central Division', lat: 0.3326, lng: 32.5953 },
  { id: 'nakasero', name: 'Nakasero', area: 'Central Division', lat: 0.324, lng: 32.58 },
  { id: 'wandegeya', name: 'Wandegeya', area: 'Kawempe Division', lat: 0.3337, lng: 32.5717 },
  { id: 'makerere', name: 'Makerere University', area: 'Makerere Hill', lat: 0.335, lng: 32.568, emoji: '🎓' },
  { id: 'bukoto', name: 'Bukoto', area: 'Nakawa Division', lat: 0.3488, lng: 32.5962 },
  { id: 'kisaasi', name: 'Kisaasi', area: 'Nakawa Division', lat: 0.37, lng: 32.605 },
  { id: 'kyanja', name: 'Kyanja', area: 'Nakawa Division', lat: 0.3885, lng: 32.596 },
  { id: 'najjera', name: 'Najjera', area: 'Kira Municipality', lat: 0.38, lng: 32.628 },
  { id: 'kira', name: 'Kira', area: 'Kira Municipality', lat: 0.397, lng: 32.64 },
  { id: 'naalya', name: 'Naalya', area: 'Kira Municipality', lat: 0.374, lng: 32.643 },
  { id: 'gayaza', name: 'Gayaza', area: 'Wakiso · Gayaza Road', lat: 0.4535, lng: 32.6155 },
  { id: 'nakawa', name: 'Nakawa', area: 'Nakawa Division', lat: 0.329, lng: 32.618 },
  { id: 'bugolobi', name: 'Bugolobi', area: 'Nakawa Division', lat: 0.319, lng: 32.615 },
  { id: 'muyenga', name: 'Muyenga', area: 'Makindye Division', lat: 0.296, lng: 32.61 },
  { id: 'kabalagala', name: 'Kabalagala', area: 'Makindye Division', lat: 0.297, lng: 32.598 },
  { id: 'kansanga', name: 'Kansanga', area: 'Makindye Division', lat: 0.29, lng: 32.602 },
  { id: 'munyonyo', name: 'Munyonyo', area: 'Makindye · Lake Victoria', lat: 0.258, lng: 32.615 },
  { id: 'nsambya', name: 'Nsambya', area: 'Makindye Division', lat: 0.3, lng: 32.583 },
  { id: 'mengo', name: 'Mengo', area: 'Rubaga Division', lat: 0.302, lng: 32.565 },
  { id: 'rubaga', name: 'Rubaga', area: 'Rubaga Division', lat: 0.303, lng: 32.553 },
  { id: 'nateete', name: 'Nateete', area: 'Rubaga Division', lat: 0.299, lng: 32.538 },
  { id: 'kawempe', name: 'Kawempe', area: 'Kawempe Division', lat: 0.38, lng: 32.56 },
  { id: 'nansana', name: 'Nansana', area: 'Wakiso', lat: 0.364, lng: 32.528 },
  { id: 'wakiso', name: 'Wakiso Town', area: 'Wakiso', lat: 0.4044, lng: 32.4594 },
  { id: 'mukono', name: 'Mukono', area: 'Mukono Town', lat: 0.3533, lng: 32.7553 },
  { id: 'kajjansi', name: 'Kajjansi', area: 'Entebbe Road', lat: 0.214, lng: 32.55 },
  { id: 'entebbe-town', name: 'Entebbe Town', area: 'Entebbe', lat: 0.064, lng: 32.479 },
];

export const findPlace = (id) => PLACES.find((p) => p.id === id) || null;

export function searchPlaces(q = '') {
  const s = q.trim().toLowerCase();
  if (!s) return PLACES;
  return PLACES.filter((p) => p.name.toLowerCase().includes(s) || p.area.toLowerCase().includes(s));
}

export function haversineKm(a, b) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
