import { useState, useEffect, useRef, useCallback } from "react";

const GEOFENCE_RADIUS_METERS = 150; // ~500 feet

interface GeoState {
  watching: boolean;
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  isNearSite: boolean;
  error: string | null;
}

/**
 * Geocode an address string to lat/lng using OpenStreetMap Nominatim (free, no API key).
 */
export async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`,
      { headers: { "User-Agent": "LovableApp/1.0" } }
    );
    const data = await res.json();
    if (data && data.length > 0) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Calculate distance between two lat/lng points in meters (Haversine).
 */
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function useGeofence(siteLat: number | null, siteLng: number | null) {
  const [state, setState] = useState<GeoState>({
    watching: false,
    lat: null,
    lng: null,
    accuracy: null,
    isNearSite: false,
    error: null,
  });
  const watchIdRef = useRef<number | null>(null);

  const startWatching = useCallback(() => {
    if (!navigator.geolocation) {
      setState((s) => ({ ...s, error: "Geolocation not supported" }));
      return;
    }

    if (watchIdRef.current !== null) return; // already watching

    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        let near = false;
        if (siteLat !== null && siteLng !== null) {
          const dist = haversineDistance(latitude, longitude, siteLat, siteLng);
          near = dist <= GEOFENCE_RADIUS_METERS;
        }
        setState({
          watching: true,
          lat: latitude,
          lng: longitude,
          accuracy,
          isNearSite: near,
          error: null,
        });
      },
      (err) => {
        setState((s) => ({
          ...s,
          watching: false,
          error: err.code === 1 ? "Location permission denied" : err.message,
        }));
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
    );
    watchIdRef.current = id;
    setState((s) => ({ ...s, watching: true }));
  }, [siteLat, siteLng]);

  const stopWatching = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setState((s) => ({ ...s, watching: false }));
  }, []);

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  return { ...state, startWatching, stopWatching };
}
