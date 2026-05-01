import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import area from "@turf/area";
import { polygon } from "@turf/helpers";
import "leaflet/dist/leaflet.css";
import "@geoman-io/leaflet-geoman-free";
import "@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css";
import { MapContainer, Marker, TileLayer, Tooltip, useMap } from "react-leaflet";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type MapMeasureDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  address: string;
  city?: string;
  onUseMeasurement: (squareFeet: number) => void;
};

const SQ_METERS_TO_SQ_FEET = 10.763910416709722;
function polygonAreaSquareMeters(latLngs: L.LatLng[]): number {
  if (!Array.isArray(latLngs) || latLngs.length < 3) return 0;

  const ring = latLngs.map((point) => [point.lng, point.lat] as [number, number]);
  const first = ring[0];
  const last = ring[ring.length - 1];

  if (!first || !last) return 0;

  if (first[0] !== last[0] || first[1] !== last[1]) {
    ring.push([first[0], first[1]]);
  }

  if (ring.length < 4) return 0;

  return area(polygon([ring]));
}

function DrawTools({
  onAreaChange,
}: {
  onAreaChange: (squareMeters: number) => void;
}) {
  const map = useMap();
  const drawnLayerRef = useRef<L.Polygon | null>(null);
  const detachLayerListenersRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const updateAreaFromLayer = (layer: L.Layer | null | undefined) => {
      if (!(layer instanceof L.Polygon)) return;
      const latlngRings = layer.getLatLngs();
      const firstRing = Array.isArray(latlngRings) ? latlngRings[0] : [];
      if (!Array.isArray(firstRing) || firstRing.length < 3) {
        onAreaChange(0);
        return;
      }
      const areaSqMeters = polygonAreaSquareMeters(firstRing as L.LatLng[]);
      onAreaChange(areaSqMeters);
    };

    const removeCurrentLayer = () => {
      if (detachLayerListenersRef.current) {
        detachLayerListenersRef.current();
        detachLayerListenersRef.current = null;
      }
      const layer = drawnLayerRef.current;
      if (layer && map.hasLayer(layer)) {
        map.removeLayer(layer);
      }
      drawnLayerRef.current = null;
    };

    const attachLayerListeners = (layer: L.Polygon) => {
      const handleLayerChange = () => updateAreaFromLayer(layer);
      layer.on("pm:edit", handleLayerChange as L.LeafletEventHandlerFn);
      layer.on("pm:update", handleLayerChange as L.LeafletEventHandlerFn);
      layer.on("pm:change", handleLayerChange as L.LeafletEventHandlerFn);
      layer.on("pm:markerdragend", handleLayerChange as L.LeafletEventHandlerFn);
      layer.on("pm:vertexadded", handleLayerChange as L.LeafletEventHandlerFn);
      layer.on("pm:vertexremoved", handleLayerChange as L.LeafletEventHandlerFn);

      detachLayerListenersRef.current = () => {
        layer.off("pm:edit", handleLayerChange as L.LeafletEventHandlerFn);
        layer.off("pm:update", handleLayerChange as L.LeafletEventHandlerFn);
        layer.off("pm:change", handleLayerChange as L.LeafletEventHandlerFn);
        layer.off("pm:markerdragend", handleLayerChange as L.LeafletEventHandlerFn);
        layer.off("pm:vertexadded", handleLayerChange as L.LeafletEventHandlerFn);
        layer.off("pm:vertexremoved", handleLayerChange as L.LeafletEventHandlerFn);
      };
    };

    (map as L.Map & { pm: any }).pm.addControls({
      position: "topright",
      drawMarker: false,
      drawPolyline: false,
      drawRectangle: false,
      drawCircle: false,
      drawCircleMarker: false,
      drawText: false,
      drawPolygon: true,
      editMode: true,
      dragMode: false,
      cutPolygon: false,
      removalMode: true,
      rotateMode: false,
    });

    (map as L.Map & { pm: any }).pm.setPathOptions({
      color: "#1f7a53",
      weight: 3,
      fillColor: "#1f7a53",
      fillOpacity: 0.2,
    });

    const onCreate = (event: { layer: L.Layer }) => {
      const layer = event.layer;
      if (!(layer instanceof L.Polygon)) return;
      removeCurrentLayer();
      drawnLayerRef.current = layer;
      attachLayerListeners(layer);
      updateAreaFromLayer(layer);
    };

    const onEdit = (event: { layer?: L.Layer; layers?: L.LayerGroup }) => {
      if (event.layer) {
        updateAreaFromLayer(event.layer);
        return;
      }
      if (event.layers) {
        event.layers.eachLayer((layer) => updateAreaFromLayer(layer));
      }
    };

    const onRemove = (event: { layer: L.Layer }) => {
      if (drawnLayerRef.current === event.layer) {
        drawnLayerRef.current = null;
        onAreaChange(0);
      }
    };

    map.on("pm:create", onCreate as L.LeafletEventHandlerFn);
    map.on("pm:edit", onEdit as L.LeafletEventHandlerFn);
    map.on("pm:remove", onRemove as L.LeafletEventHandlerFn);

    return () => {
      map.off("pm:create", onCreate as L.LeafletEventHandlerFn);
      map.off("pm:edit", onEdit as L.LeafletEventHandlerFn);
      map.off("pm:remove", onRemove as L.LeafletEventHandlerFn);
      (map as L.Map & { pm: any }).pm.removeControls();
      removeCurrentLayer();
    };
  }, [map, onAreaChange]);

  return null;
}

function MapCenterFromAddress({
  address,
  onGeocode,
}: {
  address: string;
  onGeocode: (point: [number, number] | null) => void;
}) {
  const map = useMap();

  useEffect(() => {
    let isCancelled = false;

    const geocode = async () => {
      if (!address.trim()) return;
      const encoded = encodeURIComponent(address);
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encoded}`);
      const data = (await response.json()) as Array<{ lat: string; lon: string }>;
      if (isCancelled || !Array.isArray(data) || data.length === 0) {
        onGeocode(null);
        return;
      }
      const lat = parseFloat(data[0].lat);
      const lon = parseFloat(data[0].lon);
      if (Number.isFinite(lat) && Number.isFinite(lon)) {
        map.setView([lat, lon], 22);
        onGeocode([lat, lon]);
      } else {
        onGeocode(null);
      }
    };

    void geocode();
    return () => {
      isCancelled = true;
    };
  }, [address, map, onGeocode]);

  return null;
}

export function MapMeasureDialog({
  open,
  onOpenChange,
  address,
  city,
  onUseMeasurement,
}: MapMeasureDialogProps) {
  const [areaSqMeters, setAreaSqMeters] = useState(0);
  const [geocodedPoint, setGeocodedPoint] = useState<[number, number] | null>(null);
  const fullAddress = useMemo(() => {
    return [address, city].map((value) => (value || "").trim()).filter(Boolean).join(", ");
  }, [address, city]);

  useEffect(() => {
    if (!open) {
      setAreaSqMeters(0);
      setGeocodedPoint(null);
    }
  }, [open]);

  const areaSqFeet = useMemo(() => areaSqMeters * SQ_METERS_TO_SQ_FEET, [areaSqMeters]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-screen max-w-screen h-[100dvh] sm:w-[96vw] sm:max-w-[96vw] sm:h-[92vh] p-0 gap-0 flex flex-col">
        <DialogHeader className="px-4 pt-4 pb-2 sm:pt-5">
          <DialogTitle>Measure On Map</DialogTitle>
          <DialogDescription className="text-base sm:text-sm">
            Draw a polygon around the job area to calculate square footage.
          </DialogDescription>
        </DialogHeader>
        <div className="px-4 pb-2">
          <div className="rounded-md border bg-muted/40 px-3 py-2">
            <p className="text-sm text-muted-foreground break-words">{fullAddress}</p>
            <p className="font-medium mt-1 text-base">
              Measured Area: {areaSqFeet > 0 ? areaSqFeet.toFixed(0) : "0"} sq ft
            </p>
          </div>
        </div>
        <div className="flex-1 px-4 pb-4 min-h-0">
          <div className="h-full min-h-[320px] w-full rounded-md overflow-hidden border">
            <MapContainer
              center={[39.5, -98.35]}
              zoom={22}
              maxZoom={22}
              zoomSnap={0}
              zoomDelta={0.5}
              style={{ height: "100%", width: "100%" }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.esri.com/">Esri</a> & contributors'
                url="https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                maxZoom={22}
                maxNativeZoom={20}
              />
              <MapCenterFromAddress address={fullAddress} onGeocode={setGeocodedPoint} />
              {geocodedPoint ? (
                <Marker position={geocodedPoint}>
                  <Tooltip direction="top" offset={[0, -8]} permanent>
                    Property Address
                  </Tooltip>
                </Marker>
              ) : null}
              <DrawTools onAreaChange={setAreaSqMeters} />
            </MapContainer>
          </div>
        </div>
        <div className="px-4 pb-4 flex items-center gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1 sm:flex-none">
            Cancel
          </Button>
          <Button
            type="button"
            className="flex-1 sm:flex-none"
            disabled={areaSqFeet <= 0}
            onClick={() => {
              onUseMeasurement(areaSqFeet);
              onOpenChange(false);
            }}
          >
            Use Measurement
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
