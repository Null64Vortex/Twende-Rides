// Demo driver pool. Ratings matter: VIP always gets the best-rated driver.
const POOL = {
  boda: [
    { name: 'Moses Kato', plate: 'UEX 452K', rating: 4.9, trips: 3120 },
    { name: 'Brian Ssempala', plate: 'UFB 118D', rating: 4.8, trips: 1874 },
    { name: 'Ivan Mugisha', plate: 'UEQ 907A', rating: 4.7, trips: 960 },
    { name: 'Hassan Mutebi', plate: 'UFA 233M', rating: 4.8, trips: 2210 },
    { name: 'Rashid Ssali', plate: 'UEW 641C', rating: 4.6, trips: 540 },
    { name: 'Grace Atim', plate: 'UFC 075P', rating: 4.95, trips: 4012 },
  ],
  car: [
    { name: 'Robert Okello', plate: 'UBK 318T', rating: 4.9, trips: 2650 },
    { name: 'Sarah Nakato', plate: 'UBN 552Q', rating: 4.97, trips: 3890 },
    { name: 'Joseph Lubega', plate: 'UBJ 204E', rating: 4.7, trips: 1320 },
    { name: 'Patrick Tumusiime', plate: 'UBM 771H', rating: 4.8, trips: 2005 },
    { name: 'Denis Ochieng', plate: 'UBL 039R', rating: 4.6, trips: 880 },
  ],
  van: [
    { name: 'Emmanuel Byaruhanga', plate: 'UBH 610S', rating: 4.9, trips: 1460 },
    { name: 'Charles Opio', plate: 'UBG 845F', rating: 4.8, trips: 1102 },
    { name: 'Juliet Namubiru', plate: 'UBP 127W', rating: 4.94, trips: 1980 },
    { name: 'Samuel Kiggundu', plate: 'UBF 392N', rating: 4.7, trips: 730 },
  ],
};

const MODELS = {
  boda: { basic: 'Bajaj Boxer 150', standard: 'TVS HLX 125', premium: 'Honda Ace 125', vip: 'Yamaha Crux Rev' },
  car: { basic: 'Toyota Premio', standard: 'Toyota Allion', premium: 'Toyota Mark X', vip: 'Toyota Land Cruiser Prado' },
  van: { basic: 'Toyota Noah', standard: 'Toyota Voxy', premium: 'Toyota HiAce', vip: 'Toyota Alphard' },
};

const COLORS = ['Silver', 'White', 'Black', 'Grey', 'Blue', 'Red'];

export function pickDriver(vehicleId, tierId) {
  const pool = POOL[vehicleId];
  const chosen = tierId === 'vip'
    ? [...pool].sort((a, b) => b.rating - a.rating)[0]
    : pool[Math.floor(Math.random() * pool.length)];
  const n = Math.floor(100 + Math.random() * 900);
  return {
    ...chosen,
    phone: `+256 700 ${n} ${String(Math.floor(100 + Math.random() * 900))}`,
    model: MODELS[vehicleId][tierId],
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
  };
}
