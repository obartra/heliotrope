import type { GeofenceCircleCondition } from '@heliotrope/schema';
import L from 'leaflet';
import { useCallback, useEffect, useRef } from 'react';
import { useLeafletMap } from './useLeafletMap';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface GeofenceCircleConditionEditorProps {
  value: GeofenceCircleCondition;
  onChange: (updated: GeofenceCircleCondition) => void;
}

export function GeofenceCircleConditionEditor({
  value,
  onChange,
}: GeofenceCircleConditionEditorProps) {
  const hasCenter = value.center[0] !== 0 || value.center[1] !== 0;
  const { containerRef, mapRef } = useLeafletMap({
    center: hasCenter ? value.center : undefined,
    zoom: hasCenter ? 12 : undefined,
  });

  const circleRef = useRef<L.Circle | null>(null);
  const markerRef = useRef<L.CircleMarker | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const valueRef = useRef(value);
  valueRef.current = value;

  const syncCircle = useCallback((map: L.Map, lat: number, lng: number, radius: number) => {
    if (circleRef.current) {
      circleRef.current.setLatLng([lat, lng]).setRadius(radius);
    } else {
      circleRef.current = L.circle([lat, lng], {
        radius,
        color: '#3b82f6',
        fillOpacity: 0.15,
      }).addTo(map);
    }

    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lng]);
    } else {
      markerRef.current = L.circleMarker([lat, lng], {
        radius: 6,
        color: '#3b82f6',
        fillColor: '#3b82f6',
        fillOpacity: 1,
      }).addTo(map);
    }
  }, []);

  // Sync existing value onto map
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !hasCenter) return;
    syncCircle(map, value.center[0], value.center[1], value.radiusMeters);
  }, [mapRef, hasCenter, value.center, value.radiusMeters, syncCircle]);

  // Handle map clicks
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    function handleClick(e: L.LeafletMouseEvent) {
      const lat = parseFloat(e.latlng.lat.toFixed(6));
      const lng = parseFloat(e.latlng.lng.toFixed(6));
      const v = valueRef.current;
      syncCircle(map!, lat, lng, v.radiusMeters);
      onChangeRef.current({ ...v, center: [lat, lng] });
    }

    map.on('click', handleClick);
    return () => {
      map.off('click', handleClick);
    };
  }, [mapRef, syncCircle]);

  return (
    <div className="space-y-3">
      <div ref={containerRef} className="h-[400px] rounded-md border border-input" />
      <div className="flex gap-3">
        <div className="flex-1 space-y-1">
          <Label>Latitude</Label>
          <Input
            type="number"
            step={0.000001}
            min={-90}
            max={90}
            value={value.center[0]}
            onChange={(e) => {
              const lat = parseFloat(e.target.value) || 0;
              onChange({ ...value, center: [lat, value.center[1]] });
            }}
          />
        </div>
        <div className="flex-1 space-y-1">
          <Label>Longitude</Label>
          <Input
            type="number"
            step={0.000001}
            min={-180}
            max={180}
            value={value.center[1]}
            onChange={(e) => {
              const lng = parseFloat(e.target.value) || 0;
              onChange({ ...value, center: [value.center[0], lng] });
            }}
          />
        </div>
        <div className="flex-1 space-y-1">
          <Label>Radius (m)</Label>
          <Input
            type="number"
            min={1}
            value={value.radiusMeters}
            onChange={(e) =>
              onChange({ ...value, radiusMeters: parseInt(e.target.value, 10) || 1 })
            }
          />
        </div>
      </div>
    </div>
  );
}
