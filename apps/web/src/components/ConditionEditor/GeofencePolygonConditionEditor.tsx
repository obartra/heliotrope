import type { GeofencePolygonCondition } from '@heliotrope/schema';
import L from 'leaflet';
import { useCallback, useEffect, useRef } from 'react';
import { useLeafletMap } from './useLeafletMap';
import { Button } from '@/components/ui/button';

interface GeofencePolygonConditionEditorProps {
  value: GeofencePolygonCondition;
  onChange: (updated: GeofencePolygonCondition) => void;
}

export function GeofencePolygonConditionEditor({
  value,
  onChange,
}: GeofencePolygonConditionEditorProps) {
  const hasPoints = value.points.length > 0;
  const firstPoint = value.points[0];
  const { containerRef, mapRef } = useLeafletMap({
    center: hasPoints && firstPoint ? [firstPoint[0], firstPoint[1]] : undefined,
    zoom: hasPoints ? 12 : undefined,
  });

  const polygonRef = useRef<L.Polygon | null>(null);
  const markersRef = useRef<L.CircleMarker[]>([]);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const valueRef = useRef(value);
  valueRef.current = value;

  const syncPolygon = useCallback((map: L.Map, points: [number, number][]) => {
    // Clear old markers
    for (const m of markersRef.current) m.remove();
    markersRef.current = [];

    if (points.length === 0) {
      if (polygonRef.current) {
        polygonRef.current.remove();
        polygonRef.current = null;
      }
      return;
    }

    const latLngs = points.map(([lat, lng]) => [lat, lng] as L.LatLngTuple);

    if (polygonRef.current) {
      polygonRef.current.setLatLngs(latLngs);
    } else {
      polygonRef.current = L.polygon(latLngs, { color: '#3b82f6', fillOpacity: 0.15 }).addTo(map);
    }

    // Add vertex markers
    for (const pt of points) {
      const marker = L.circleMarker([pt[0], pt[1]], {
        radius: 6,
        color: '#3b82f6',
        fillColor: '#3b82f6',
        fillOpacity: 1,
      }).addTo(map);
      markersRef.current.push(marker);
    }
  }, []);

  // Sync existing value onto map
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    syncPolygon(map, value.points);
  }, [mapRef, value.points, syncPolygon]);

  // Handle map clicks to add vertices
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    function handleClick(e: L.LeafletMouseEvent) {
      const lat = parseFloat(e.latlng.lat.toFixed(6));
      const lng = parseFloat(e.latlng.lng.toFixed(6));
      const v = valueRef.current;
      const next = [...v.points, [lat, lng] as [number, number]];
      syncPolygon(map!, next);
      onChangeRef.current({ ...v, points: next });
    }

    map.on('click', handleClick);
    return () => {
      map.off('click', handleClick);
    };
  }, [mapRef, syncPolygon]);

  return (
    <div className="space-y-3">
      <div ref={containerRef} className="h-[400px] rounded-md border border-input" />
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {value.points.length} {value.points.length === 1 ? 'vertex' : 'vertices'} placed. Click on
          the map to add points.
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onChange({ ...value, points: [] })}
          disabled={value.points.length === 0}
        >
          Clear
        </Button>
      </div>
      {value.points.length > 0 && value.points.length < 3 && (
        <p className="text-sm text-destructive">
          At least 3 points are required to form a polygon.
        </p>
      )}
      {value.points.length > 0 && (
        <div className="text-xs text-muted-foreground space-y-0.5 max-h-32 overflow-y-auto">
          {value.points.map((pt, i) => (
            <div key={i}>
              {i + 1}. [{pt[0]}, {pt[1]}]
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
