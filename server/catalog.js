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
    id: 'basic', name: 'Basic',
    travel: { summary: 'Normal', perks: ['Everyday ride'] },
    delivery: { summary: 'Normal delivery, same day', perks: ['Same day'] },
  },
  {
    id: 'standard', name: 'Standard',
    travel: {
      summary: 'AC + Clean', perks: ['Air conditioning', 'Clean vehicle'],
      boda: { summary: 'Clean bike + Spare helmet', perks: ['Clean bike', 'Spare helmet'] },
    },
    delivery: { summary: 'Careful handling + Tracking', perks: ['Careful handling', 'Live tracking'] },
  },
  {
    id: 'premium', name: 'Premium',
    travel: {
      summary: 'Big car + Water + Charger', perks: ['Bigger car', 'Free water', 'Phone charger'],
      boda: { summary: 'Big bike + Water + Charger', perks: ['Bigger bike', 'Free water', 'Phone charger'] },
      van: { summary: 'Big van + Water + Charger', perks: ['Bigger van', 'Free water', 'Phone charger'] },
    },
    delivery: { summary: 'Express + Insured + Photo on delivery', perks: ['Express', 'Insured', 'Photo on delivery'] },
  },
  {
    id: 'vip', name: 'VIP',
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
  { id: 'small', name: 'Small', hint: 'Fits in a bag' },
  { id: 'medium', name: 'Medium', hint: 'Fits on a car seat' },
  { id: 'big', name: 'Big', hint: 'Needs a van' },
];

export const PAYMENTS = [
  { id: 'cash', emoji: '💵', name: 'Cash', hint: 'Pay your driver directly' },
  { id: 'momo', emoji: '📱', name: 'Mobile Money', hint: 'MTN MoMo or Airtel Money' },
];

// Average km/h in Kampala traffic; long trips (expressway) move faster.
const SPEED = { boda: 28, car: 22, van: 20 };
export const ROAD_FACTOR = 1.3;

export function etaMinutes(vehicleId, straightKm) {
  const km = straightKm * ROAD_FACTOR;
  const speed = SPEED[vehicleId] * (km > 20 ? 1.8 : 1);
  return Math.max(1, Math.ceil((km / speed) * 60));
}
