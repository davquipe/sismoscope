import 'leaflet/dist/leaflet.css';
import 'react-leaflet-cluster/dist/assets/MarkerCluster.css';
import 'react-leaflet-cluster/dist/assets/MarkerCluster.Default.css';

import L, { type LatLngBounds } from 'leaflet';
import { useCallback, useEffect } from 'react';
import { MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';

import type { EarthquakeEvent, EarthquakeId } from '@/entities/earthquake/model/types';
import { REGION_PRESETS, type RegionPresetId } from '@/entities/region/regions';
import { formatDateTime, formatNumber } from '@/shared/lib/format';

export interface ViewportBounds {
  minLatitude: number;
  maxLatitude: number;
  minLongitude: number;
  maxLongitude: number;
}

interface EarthquakeMapProps {
  events: readonly EarthquakeEvent[];
  selectedId?: EarthquakeId | null;
  onSelect?: (event: EarthquakeEvent) => void;
  region?: RegionPresetId;
  height?: number | string;
  interactive?: boolean;
  onViewportChange?: (bounds: ViewportBounds) => void;
}

function markerClass(event: EarthquakeEvent): string {
  const depth = event.coordinates.depthKm;
  if (depth >= 300) return 'deep';
  if (depth >= 70) return 'intermediate';
  return 'shallow';
}

function markerIcon(event: EarthquakeEvent, selected: boolean): L.DivIcon {
  const label = event.magnitude === null ? '—' : event.magnitude.toFixed(1);
  const size = Math.max(27, Math.min(45, 25 + Math.max(0, event.magnitude ?? 0) * 2.4));
  return L.divIcon({
    className: '',
    html: `<span class="quake-marker quake-marker--${markerClass(event)}${selected ? ' is-selected' : ''}" style="width:${size}px;height:${size}px">${label}</span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function SelectionController({
  event,
  region,
}: {
  event: EarthquakeEvent | null;
  region: RegionPresetId;
}) {
  const map = useMap();
  useEffect(() => {
    if (event) {
      map.flyTo(
        [event.coordinates.latitude, event.coordinates.longitude],
        Math.max(map.getZoom(), 7),
        {
          duration: 0.6,
        },
      );
      return;
    }
    const preset = REGION_PRESETS[region];
    map.setView([preset.mapCenter[0], preset.mapCenter[1]], preset.mapZoom);
  }, [event, map, region]);
  return null;
}

function ViewportReporter({ onChange }: { onChange: (bounds: ViewportBounds) => void }) {
  const report = useCallback(
    (bounds: LatLngBounds) => {
      onChange({
        minLatitude: bounds.getSouth(),
        maxLatitude: bounds.getNorth(),
        minLongitude: bounds.getWest(),
        maxLongitude: bounds.getEast(),
      });
    },
    [onChange],
  );
  const map = useMapEvents({
    moveend: () => report(map.getBounds()),
  });
  useEffect(() => report(map.getBounds()), [map, report]);
  return null;
}

export default function EarthquakeMap({
  events,
  selectedId = null,
  onSelect,
  region = 'peru',
  height = 420,
  interactive = true,
  onViewportChange,
}: EarthquakeMapProps) {
  const preset = REGION_PRESETS[region];
  const selected = events.find((event) => event.id === selectedId) ?? null;

  return (
    <div className="earthquake-map" style={{ height }}>
      <MapContainer
        center={[preset.mapCenter[0], preset.mapCenter[1]]}
        zoom={preset.mapZoom}
        minZoom={2}
        maxZoom={14}
        scrollWheelZoom={interactive}
        dragging={interactive}
        zoomControl={interactive}
        attributionControl
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors · Sismos: <a href="https://earthquake.usgs.gov/">USGS</a>'
          maxZoom={19}
        />
        <MarkerClusterGroup chunkedLoading removeOutsideVisibleBounds>
          {events.map((event) => (
            <Marker
              key={event.id}
              position={[event.coordinates.latitude, event.coordinates.longitude]}
              icon={markerIcon(event, event.id === selectedId)}
              eventHandlers={{ click: () => onSelect?.(event) }}
            >
              <Popup>
                <strong>
                  {event.magnitude === null ? 'M —' : `M ${event.magnitude.toFixed(1)}`}
                </strong>
                <br />
                {event.place}
                <br />
                <small>
                  {formatDateTime(event.occurredAt)} ·{' '}
                  {formatNumber(event.coordinates.depthKm, ' km')}
                </small>
              </Popup>
            </Marker>
          ))}
        </MarkerClusterGroup>
        <SelectionController event={selected} region={region} />
        {onViewportChange ? <ViewportReporter onChange={onViewportChange} /> : null}
      </MapContainer>
      <div className="map-legend" aria-label="Leyenda del mapa">
        <strong>Profundidad</strong>
        <span>
          <i className="legend-dot legend-dot--shallow" />
          0–70 km
        </span>
        <span>
          <i className="legend-dot legend-dot--intermediate" />
          70–300 km
        </span>
        <span>
          <i className="legend-dot legend-dot--deep" />
          300+ km
        </span>
        <small>El tamaño indica magnitud</small>
      </div>
    </div>
  );
}
