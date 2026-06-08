import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface MapPreviewProps {
  clockIn?: Coordinates | null;
  clockOut?: Coordinates | null;
}

interface Coordinates {
  lat: number | null;
  lng: number | null;
}

export function MapPreview({ clockIn, clockOut }: MapPreviewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const [mapUnavailable, setMapUnavailable] = useState(false);

  const points = [
    validPoint(clockIn) ? { label: 'Clock in', lat: clockIn.lat, lng: clockIn.lng, className: 'clock-in-pin' } : null,
    validPoint(clockOut) ? { label: 'Clock out', lat: clockOut.lat, lng: clockOut.lng, className: 'clock-out-pin' } : null
  ].filter((point): point is { label: string; lat: number; lng: number; className: string } => Boolean(point));

  useEffect(() => {
    if (points.length === 0 || !containerRef.current || typeof window === 'undefined' || typeof document === 'undefined') return undefined;

    try {
      const map = L.map(containerRef.current, {
        attributionControl: false,
        dragging: false,
        scrollWheelZoom: false,
        doubleClickZoom: false,
        boxZoom: false,
        keyboard: false,
        zoomControl: false
      });
      mapRef.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19
      }).addTo(map);

      const bounds = L.latLngBounds(points.map((point) => [point.lat, point.lng]));
      points.forEach((point) => {
        L.marker([point.lat, point.lng], {
          icon: L.divIcon({
            className: `map-pin ${point.className}`,
            html: `<span>${point.label}</span>`,
            iconSize: [96, 28],
            iconAnchor: [12, 28]
          })
        }).addTo(map);
      });

      map.fitBounds(bounds.pad(0.35), { maxZoom: 16 });
      window.setTimeout(() => map.invalidateSize(), 0);
    } catch {
      setMapUnavailable(true);
    }

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [points.map((point) => `${point.label}:${point.lat}:${point.lng}`).join('|')]);

  if (points.length === 0) return null;
  if (mapUnavailable) {
    return <div className="map-fallback">Map preview unavailable. GPS coordinates are still saved with this entry.</div>;
  }

  return <div className="map-preview" ref={containerRef} aria-label="Clock GPS map preview" />;
}

function validPoint(point: Coordinates | null | undefined): point is { lat: number; lng: number } {
  return Number.isFinite(point?.lat) && Number.isFinite(point?.lng);
}
