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

## How it works

**Client** (`/`): Home → Service → Vehicle → Class → Details → Confirm → live booking.
Pickup is the phone's GPS location. There are no fixed prices.

**Driver** (`/driver`): sign up with photo, phone, vehicle model, plate and colour → go online (GPS is sent every few seconds).

1. The client requests. The server offers the job to the **nearest online driver** with the right vehicle.
   The driver has 30 s to accept; if they decline or time out, the next nearest driver is alerted.
2. The driver sees the destination and how far away the client is, but **not where the client is**.
3. After accepting, the driver gets the client's phone number and **calls to agree on a price**.
   The client sees the driver's photo, name, vehicle model, colour and number plate.
4. The client taps **"We agreed on the price"**. Only then does the driver see the client's live location
   (with a Google Maps "Navigate" button).
5. Driver taps **I've arrived → Start trip / Package picked → Complete**. The client follows on the map and rates the driver.

## Project layout

```
server/
  index.js      Express routes + request validation
  bookings.js   dispatch (nearest driver, 30 s offers), statuses, chat, privacy rules
  drivers.js    driver registry, GPS positions, ratings
  catalog.js    services, vehicles, classes, package sizes, ETA estimate
  places.js     Kampala/Wakiso/Entebbe destinations
  routing.js    road routes (OSRM, falls back to a curve offline)
client/src/
  App.jsx       client flow, GPS pickup, driver mode at /driver
  screens/      Home, ChoiceSteps, Details, Confirm, LiveBooking
  driver/       DriverApp, DriverRegister, DriverDashboard
  components/   MapView (Leaflet), PlaceSearch, ChatSheet, UI bits
```

## Testing with two phones

Open the app on one phone as a client and `/driver` on another (must be HTTPS, e.g. the Render link, for GPS to work).
Register the driver, tap **Go online**, then request a ride from the client phone.

## Current limitations

- Data is kept in memory: bookings are lost when the server restarts. Drivers re-register automatically from their phone.
- Real-time uses polling every 2 seconds (no WebSockets yet).
- The driver page must stay open on screen; phones pause GPS for background browser tabs. A native driver app would fix this.
- Anyone can sign up as a driver: there is no ID or licence verification yet.
- Map tiles come from openstreetmap.org, fine for testing but not heavy production traffic.
