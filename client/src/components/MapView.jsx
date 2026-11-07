import { useEffect, useMemo } from 'react';
import { MapContainer, Marker, Polyline, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';

const KAMPALA = [0.3476, 32.5825];
const EMOJI = { boda: '🏍️', car: '🚗', van: '🚐' };

const pickupIcon = L.divIcon({ className: 'mk-wrap', html: '<div class="mk mk-pickup"></div>', iconSize: [22, 22], iconAnchor: [11, 11] });
const dropoffIcon = L.divIcon({ className: 'mk-wrap', html: '<div class="mk mk-dropoff"></div>', iconSize: [22, 22], iconAnchor: [11, 11] });

function Fit({ points, fitKey, padTop, padBottom }) {
  const map = useMap();
  useEffect(() => {
    if (!points?.length) return;
    const bounds = L.latLngBounds(points);
    map.fitBounds(bounds, { paddingTopLeft: [36, padTop], paddingBottomRight: [36, padBottom], maxZoom: 16, animate: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey, map]);
  return null;
}

export default function MapView({
  pickup, dropoff, vehicle, driver, toPickupRoute, tripRoute,
  fitPoints, fitKey, padTop = 40, padBottom = 40, interactive = true, className = '',
}) {
  const driverIcon = useMemo(() => L.divIcon({
    className: 'mk-wrap driver-marker',
    html: `<div class="mk-driver">${EMOJI[vehicle] || '🚗'}</div>`,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  }), [vehicle]);

  const fallback = [pickup && [pickup.lat, pickup.lng], dropoff && [dropoff.lat, dropoff.lng]].filter(Boolean);

  return (
    <MapContainer
      center={pickup ? [pickup.lat, pickup.lng] : KAMPALA}
      zoom={13}
      zoomControl={false}
      dragging={interactive}
      scrollWheelZoom={interactive}
      doubleClickZoom={interactive}
      touchZoom={interactive}
      keyboard={interactive}
      className={`map ${className}`}
    >
      <TileLayer
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        maxZoom={19}
      />
      {tripRoute && (
        <>
          <Polyline positions={tripRoute} pathOptions={{ color: '#14151A', weight: 9, opacity: 0.12 }} />
          <Polyline positions={tripRoute} pathOptions={{ color: '#14151A', weight: 4.5, opacity: 0.9 }} />
        </>
      )}
      {toPickupRoute && (
        <Polyline positions={toPickupRoute} pathOptions={{ color: '#F2A900', weight: 5, dashArray: '1 10', lineCap: 'round' }} />
      )}
      {pickup && <Marker position={[pickup.lat, pickup.lng]} icon={pickupIcon} />}
      {dropoff && <Marker position={[dropoff.lat, dropoff.lng]} icon={dropoffIcon} />}
      {driver && <Marker position={driver} icon={driverIcon} zIndexOffset={1000} />}
      <Fit points={fitPoints?.length ? fitPoints : fallback} fitKey={fitKey} padTop={padTop} padBottom={padBottom} />
    </MapContainer>
  );
}
