import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "@geoman-io/leaflet-geoman-free";
import "@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type MapMeasureDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  address: string;
  onUseMeasurement: (squareFeet: number) => void;
};

const SQ_METERS_TO_SQ_FEET = 10.763910416709722;
const EARTH_RADIUS_METERS = 6378137;

function geodesicAreaSquareMeters(latLngs: L.LatLng[]): number {
  if (!Array.isArray(latLngs) || latLngs.length < 3) return 0;

  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  let area = 0;

  for (let i = 0; i < latLngs.length; i += 1) {
    const p1 = latLngs[i];
    const p2 = latLngs[(i + 1) % latLngs.length];
    area += toRadians(p2.lng - p1.lng) * (2 + Math.sin(toRadians(p1.lat)) + Math.sin(toRadians(p2.lat)));
  }

  area = (area * EARTH_RADIUS_METERS * EARTH_RADIUS_METERS) / 2;
  return Math.abs(area);
}

function DrawTools({
  onAreaChange,
}: {
  onAreaChange: (squareMeters: number) => void;
}) {
  const map = useMap();
  const drawnLayerRef = useRef<L.Polygon | null>(null);

  useEffect(() => {
    const updateAreaFromLayer = (layer: L.Layer) => {
      if (!(layer instanceof L.Polygon)) return;
      const latlngRings = layer.getLatLngs();
      const firstRing = Array.isArray(latlngRings) ? latlngRings[0] : [];
      if (!Array.isArray(firstRing) || firstRing.length < 3) {
        onAreaChange(0);
        return;
      }
      const areaSqMeters = geodesicAreaSquareMeters(firstRing as L.LatLng[]);
      onAreaChange(areaSqMeters);
    };

    const removeCurrentLayer = () => {
      const layer = drawnLayerRef.current;
      if (layer && map.hasLayer(layer)) {
        map.removeLayer(layer);
      }
      drawnLayerRef.current = null;
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
      updateAreaFromLayer(layer);
    };

    const onEdit = (event: { layer: L.Layer }) => {
      updateAreaFromLayer(event.layer);
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

function MapCenterFromAddress({ address }: { address: string }) {
  const map = useMap();

  useEffect(() => {
    let isCancelled = false;

    const geocode = async () => {
      const encoded = encodeURIComponent(address);
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encoded}`);
      const data = (await response.json()) as Array<{ lat: string; lon: string }>;
      if (isCancelled || !Array.isArray(data) || data.length === 0) return;
      const lat = parseFloat(data[0].lat);
      const lon = parseFloat(data[0].lon);
      if (Number.isFinite(lat) && Number.isFinite(lon)) {
        map.setView([lat, lon], 19);
      }
    };

    void geocode();
    return () => {
      isCancelled = true;
    };
  }, [address, map]);

  return null;
}

export function MapMeasureDialog({
  open,
  onOpenChange,
  address,
  onUseMeasurement,
}: MapMeasureDialogProps) {
  const [areaSqMeters, setAreaSqMeters] = useState(0);

  useEffect(() => {
    if (!open) setAreaSqMeters(0);
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
            <p className="text-sm text-muted-foreground truncate">{address}</p>
            <p className="font-medium mt-1 text-base">
              Measured Area: {areaSqFeet > 0 ? areaSqFeet.toFixed(0) : "0"} sq ft
            </p>
          </div>
        </div>
        <div className="flex-1 px-4 pb-4 min-h-0">
          <div className="h-full min-h-[320px] w-full rounded-md overflow-hidden border">
            <MapContainer
              center={[39.5, -98.35]}
              zoom={4}
              maxZoom={19}
              zoomSnap={0}
              zoomDelta={0.5}
              style={{ height: "100%", width: "100%" }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.esri.com/">Esri</a>'
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                maxZoom={19}
                maxNativeZoom={19}
              />
              <MapCenterFromAddress address={address} />
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
