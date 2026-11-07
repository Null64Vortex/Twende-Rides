# Twende

Rides, airport pickups, moving and deliveries around Kampala.
React (Vite) frontend + Node.js (Express) backend.

## Run it

```bash
npm run setup     # first time only: installs everything
npm run dev       # API on :4000 + web app on http://localhost:5173
```

Production-style (one server):

```bash
npm run build     # builds client/dist
npm start         # serves app + API on http://localhost:4000
```

## Flow

Home → Service → Vehicle → Class → Details → Confirm → Driver matching → Live trip

## Project layout

```
server/
  index.js      Express routes + request validation
  catalog.js    services, vehicles, classes, package sizes, UGX pricing
  places.js     Kampala/Wakiso/Entebbe places with coordinates
  drivers.js    demo driver pool
  bookings.js   in-memory bookings + simulated trip timeline + chat
  routing.js    road routes (OSRM, falls back to a curve offline)
client/src/
  App.jsx       screen flow + booking draft state
  screens/      Home, ChoiceSteps (service/vehicle/class), Details, Confirm, Matching, Trip
  components/   MapView (Leaflet), PlaceSearch, ChatSheet, UI bits
```

## API

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/catalog` | services, vehicles, classes, sizes, payments |
| GET | `/api/places?q=` | search places |
| GET | `/api/route?from=&to=` | road route between two places |
| POST | `/api/quote` | price, distance and duration |
| POST | `/api/bookings` | create a booking |
| GET | `/api/bookings/:id` | live status, driver position, messages |
| POST | `/api/bookings/:id/messages` | chat with the driver |
| POST | `/api/bookings/:id/cancel` | cancel |
| POST | `/api/bookings/:id/start` | start a scheduled trip now (demo) |
| POST | `/api/bookings/:id/rating` | rate 1 to 5 |

## Demo limitations

- Bookings live in memory and reset when the server restarts.
- Drivers, matching, movement and chat replies are simulated (a trip takes about 75 seconds).
- Payments are not charged; Mobile Money is a selection only.
- Map tiles come from openstreetmap.org, which is fine for development but not for heavy production traffic.
