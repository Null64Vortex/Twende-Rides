import { haversineKm } from './places.js';

export const SERVICES = [
  { id: 'ride', emoji: '🚖', name: 'Ride', title: 'Ride', tagline: 'You travel' },
  { id: 'airport', emoji: '✈️', name: 'Airport', title: 'Airport Pickup', tagline: 'You travel to/from Entebbe' },
  { id: 'moving', emoji: '📦', name: 'Moving', title: 'Moving', tagline: 'You + house / luggage travel' },
  { id: 'delivery', emoji: '🛵', name: 'Delivery', title: 'Delivery', tagline: "Package only, you don't travel" },
];

export const VEHICLES = [
  {
    id: 'boda', emoji: '🏍️', name: 'Boda', seats: '1 passenger',
    desc: {
      ride: 'Beat the traffic, fastest option',
      airport: 'Light bag only, quickest to Entebbe',
      moving: 'A bag or two, small items',
      delivery: 'Small package, documents, food',
    },
    sizes: ['small'],
  },
  {
    id: 'car', emoji: '🚗', name: 'Car', seats: 'Up to 4 passengers',
    desc: {
      ride: 'Comfortable for up to 4 people',
      airport: 'Up to 3 suitcases',
      moving: 'Suitcases and small boxes',
      delivery: 'Medium box, fragile',
    },
    sizes: ['small', 'medium'],
  },
  {
    id: 'van', emoji: '🚐', name: 'Van', seats: 'Up to 7 passengers',
    desc: {
      ride: 'Groups and families',
      airport: 'Groups with lots of luggage',
      moving: 'Furniture, house items, many boxes',
      delivery: 'Big box, many items',
    },
    sizes: ['small', 'medium', 'big'],
  },
];

// Travel text can be adjusted per vehicle (an "SUV" makes no sense on a boda).
export const TIERS = [
  {
    id: 'basic', name: 'Basic', multiplier: 1,
    travel: { summary: 'Normal', perks: ['Everyday ride'] },
    delivery: { summary: 'Normal delivery, same day', perks: ['Same day'] },
  },
  {
    id: 'standard', name: 'Standard', multiplier: 1.1,
    travel: {
      summary: 'AC + Clean', perks: ['Air conditioning', 'Clean vehicle'],
      boda: { summary: 'Clean bike + Spare helmet', perks: ['Clean bike', 'Spare helmet'] },
    },
    delivery: { summary: 'Careful handling + Tracking', perks: ['Careful handling', 'Live tracking'] },
  },
  {
    id: 'premium', name: 'Premium', multiplier: 1.4,
    travel: {
      summary: 'Big car + Water + Charger', perks: ['Bigger car', 'Free water', 'Phone charger'],
      boda: { summary: 'Big bike + Water + Charger', perks: ['Bigger bike', 'Free water', 'Phone charger'] },
      van: { summary: 'Big van + Water + Charger', perks: ['Bigger van', 'Free water', 'Phone charger'] },
    },
    delivery: { summary: 'Express + Insured + Photo on delivery', perks: ['Express', 'Insured', 'Photo on delivery'] },
  },
  {
    id: 'vip', name: 'VIP', multiplier: 2,
    travel: {
      summary: 'SUV + Best driver + Airport meet inside', perks: ['SUV', 'Best driver', 'Airport meet inside'],
      boda: { summary: 'Best rider + Rain gear + Airport meet inside', perks: ['Best rider', 'Rain gear', 'Airport meet inside'] },
      van: { summary: 'Executive van + Best driver + Airport meet inside', perks: ['Executive van', 'Best driver', 'Airport meet inside'] },
    },
    delivery: { summary: 'Urgent in 1 hour + Signature + Door to door', perks: ['Within 1 hour', 'Signature', 'Door to door'] },
  },
];

export const CONTENTS = [
  { id: 'documents', emoji: '📄', name: 'Documents' },
  { id: 'food', emoji: '🍲', name: 'Food' },
  { id: 'box', emoji: '📦', name: 'Box' },
];

export const SIZES = [
  { id: 'small', name: 'Small', hint: 'Fits in a bag', fee: 0 },
  { id: 'medium', name: 'Medium', hint: 'Fits on a car seat', fee: 2000 },
  { id: 'big', name: 'Big', hint: 'Needs a van', fee: 5000 },
];

export const PAYMENTS = [
  { id: 'cash', emoji: '💵', name: 'Cash', hint: 'Pay your driver directly' },
  { id: 'momo', emoji: '📱', name: 'Mobile Money', hint: 'MTN MoMo or Airtel Money' },
];

// UGX pricing. Speeds are average km/h in Kampala traffic.
export const PRICING = {
  boda: { base: 2000, perKm: 700, min: 3000, speed: 28, pickupEta: 3 },
  car: { base: 5000, perKm: 1700, min: 8000, speed: 22, pickupEta: 6 },
  van: { base: 12000, perKm: 3000, min: 20000, speed: 20, pickupEta: 9 },
};

const SERVICE_FEES = {
  airport: { boda: 3000, car: 10000, van: 15000 },
  moving: { boda: 3000, car: 10000, van: 30000 },
};

const ROAD_FACTOR = 1.3; // straight line -> road distance

// Long trips (e.g. Entebbe Expressway) move faster than city traffic.
export const speedFor = (vehicleId, km) => PRICING[vehicleId].speed * (km > 20 ? 1.8 : 1);

export function quote({ service, vehicle, tier, pickup, dropoff, size }) {
  const p = PRICING[vehicle.id];
  const km = Math.max(1, haversineKm(pickup, dropoff) * ROAD_FACTOR);
  let fee = 0;
  if (service.id === 'airport' || service.id === 'moving') fee = SERVICE_FEES[service.id][vehicle.id];
  if (service.id === 'delivery') fee = SIZES.find((s) => s.id === size)?.fee ?? 0;
  const raw = (p.base + p.perKm * km + fee) * tier.multiplier;
  const price = Math.max(p.min, Math.round(raw / 500) * 500);
  return {
    price,
    currency: 'UGX',
    distanceKm: Math.round(km * 10) / 10,
    durationMin: Math.max(3, Math.round((km / speedFor(vehicle.id, km)) * 60)),
    pickupEtaMin: p.pickupEta,
  };
}
