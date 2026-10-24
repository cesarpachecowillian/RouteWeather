import { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Polyline, CircleMarker, Tooltip, useMap } from 'react-leaflet';
import type { LatLngBoundsExpression, LatLngExpression } from 'leaflet';
import {
  Map as MapIcon, Satellite, Compass,
  Sun, Cloud, CloudFog, CloudDrizzle, CloudRain,
  CloudSnow, CloudLightning, Droplets, Wind, Thermometer,
} from 'lucide-react';
import type { Waypoint } from '../types/trip';
import { formatTime, severityColor } from '../utils/weather';
import { decodePolyline } from '../utils/polyline';

type Layer = 'street' | 'satellite';

const WEATHER_ICONS: Record<string, typeof Sun> = {
  sunny: Sun, cloudy: Cloud, foggy: CloudFog,
  drizzle: CloudDrizzle, rainy: CloudRain, showers: CloudRain,
  snowy: CloudSnow, thunderstorm: CloudLightning,
};

const TILES: Record<Layer, { url: string; attribution: string }> = {
  street: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap',
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri',
  },
};

// Default Brazil-wide bounds shown before any route is plotted.
const DEFAULT_BOUNDS: LatLngBoundsExpression = [
  [-33.8, -73.0],
  [5.3, -34.5],
];

interface Props {
  waypoints?: Waypoint[];
  encodedPolyline?: string;
  loading?: boolean;
  focusedIdx?: number | null;
  onWaypointClick?: (idx: number) => void;
}

export function RouteMap({ waypoints, encodedPolyline, loading, focusedIdx, onWaypointClick }: Props) {
  const [layer, setLayer] = useState<Layer>('street');
  const hasRoute = !!waypoints && waypoints.length > 0;

  return (
    <div className="relative h-full w-full">
      <MapContainer
        bounds={DEFAULT_BOUNDS}
        boundsOptions={{ padding: [20, 20] }}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom
        worldCopyJump
      >
        <TileLayer key={layer} attribution={TILES[layer].attribution} url={TILES[layer].url} />
        {hasRoute && (
          <RouteLayer
            waypoints={waypoints!}
            encodedPolyline={encodedPolyline}
            layer={layer}
            focusedIdx={focusedIdx ?? null}
            onWaypointClick={onWaypointClick}
          />
        )}
      </MapContainer>

      <div className="absolute bottom-6 left-3 z-[500] flex border-2 border-[var(--ink)] shadow-pop-sm">
        <LayerButton
          active={layer === 'street'}
          onClick={() => setLayer('street')}
          icon={<MapIcon className="w-3.5 h-3.5" strokeWidth={2.4} />}
          label="Mapa"
        />
        <LayerButton
          active={layer === 'satellite'}
          onClick={() => setLayer('satellite')}
          icon={<Satellite className="w-3.5 h-3.5" strokeWidth={2.4} />}
          label="Satélite"
        />
      </div>

      {loading && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[500] bg-[var(--ink)] text-[var(--accent)] border-2 border-[var(--ink)] shadow-pop-sm flex items-center gap-2 px-3 py-1.5 pointer-events-none">
          <Compass className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: '2s' }} strokeWidth={2.4} />
          <span className="text-[10px] uppercase tracking-[0.2em] font-extrabold">
            Calculando rota
          </span>
        </div>
      )}
    </div>
  );
}

function RouteLayer({
  waypoints, encodedPolyline, layer, focusedIdx, onWaypointClick,
}: {
  waypoints: Waypoint[]; encodedPolyline?: string; layer: Layer;
  focusedIdx: number | null; onWaypointClick?: (idx: number) => void;
}) {
  const map = useMap();
  const lastWaypointsRef = useRef<Waypoint[] | null>(null);

  useEffect(() => {
    if (waypoints.length === 0) return;
    // Route changed → always fit bounds and ignore any stale focus.
    if (lastWaypointsRef.current !== waypoints) {
      lastWaypointsRef.current = waypoints;
      const lats = waypoints.map((w) => w.lat);
      const lngs = waypoints.map((w) => w.lng);
      const bounds: LatLngBoundsExpression = [
        [Math.min(...lats), Math.min(...lngs)],
        [Math.max(...lats), Math.max(...lngs)],
      ];
      map.flyToBounds(bounds, { padding: [40, 40], duration: 0.6 });
      return;
    }
    // Same route, only focus changed.
    if (focusedIdx == null) return;
    const wp = waypoints[focusedIdx];
    if (!wp) return;
    const targetZoom = Math.max(map.getZoom(), 11);
    map.flyTo([wp.lat, wp.lng], targetZoom, { duration: 0.5 });
  }, [waypoints, focusedIdx, map]);

  const positions: LatLngExpression[] = useMemo(() => {
    if (encodedPolyline) {
      try {
        return decodePolyline(encodedPolyline) as LatLngExpression[];
      } catch {
        // fall through to waypoint-based fallback
      }
    }
    return waypoints.map((w) => [w.lat, w.lng]);
  }, [encodedPolyline, waypoints]);

  const polylineOuter = layer === 'satellite' ? '#000' : '#0a0a0a';
  const polylineInner = '#fbbf24';
  const markerStroke = layer === 'satellite' ? '#fbbf24' : '#0a0a0a';

  return (
    <>
      <Polyline positions={positions} pathOptions={{ color: polylineOuter, weight: 7, opacity: 0.85 }} />
      <Polyline positions={positions} pathOptions={{ color: polylineInner, weight: 3.5, opacity: 1 }} />
      {waypoints.map((wp, i) => {
        const isEndpoint = i === 0 || i === waypoints.length - 1;
        const isFocused = i === focusedIdx;
        const baseRadius = isEndpoint ? 10 : 6;
        return (
          <CircleMarker
            key={i}
            center={[wp.lat, wp.lng]}
            radius={isFocused ? baseRadius + 5 : baseRadius}
            pathOptions={{
              color: isFocused ? '#fbbf24' : markerStroke,
              weight: isFocused ? 3.5 : 2.5,
              fillColor: severityColor(wp.weather),
              fillOpacity: 1,
            }}
            eventHandlers={{
              click: () => onWaypointClick?.(i),
            }}
          >
            <Tooltip
              direction="top"
              offset={[0, -10]}
              opacity={1}
              sticky={false}
              className="rw-tip"
            >
              <WaypointHoverCard wp={wp} />
            </Tooltip>
          </CircleMarker>
        );
      })}
    </>
  );
}

function WaypointHoverCard({ wp }: { wp: Waypoint }) {
  const w = wp.weather;
  const Icon = w ? WEATHER_ICONS[w.icon] ?? Cloud : Cloud;
  return (
    <div
      className="bg-[var(--surface)] text-[var(--ink)] border-2 border-[var(--ink)] min-w-[240px]"
      style={{ boxShadow: '5px 5px 0 var(--ink)' }}
    >
      <div className="bg-[var(--bg-soft)] border-b-2 border-[var(--ink)] px-3 py-1.5 flex items-center justify-between font-mono-num font-extrabold text-[11px] uppercase tracking-[0.18em]">
        <span className="text-[var(--ink)]">KM {wp.distanceFromStartKm.toFixed(0)}</span>
        <span className="text-[var(--accent)]">{formatTime(wp.estimatedArrival)}</span>
      </div>
      <div className="px-3 py-2.5 space-y-2.5">
        {wp.cityName ? (
          <p className="text-[14px] font-bold leading-tight break-words text-[var(--ink)]">{wp.cityName}</p>
        ) : (
          <p className="text-[11px] uppercase tracking-wider text-[var(--ink-muted)] font-bold">
            Trecho rural
          </p>
        )}

        {w && (
          <>
            <div className="flex items-center gap-3 pt-2 border-t border-[var(--line)]">
              <Icon className="w-9 h-9 shrink-0" strokeWidth={1.8} style={{ color: 'var(--ink)' }} />
              <div className="min-w-0">
                <p className="font-mono-num font-extrabold text-3xl leading-none text-[var(--ink)]">
                  {w.temperatureCelsius.toFixed(0)}°
                </p>
                <p className="text-[11px] text-[var(--ink-muted)] uppercase tracking-wide font-bold leading-tight mt-1">
                  {w.conditionLabel}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[var(--line)]">
              <Stat icon={<Thermometer className="w-3.5 h-3.5" />} label="Umid." value={`${w.humidity}%`} />
              <Stat icon={<Wind className="w-3.5 h-3.5" />} label="Vento" value={`${w.windSpeedKmh.toFixed(0)}`} suffix="km/h" />
              <Stat icon={<Droplets className="w-3.5 h-3.5" />} label="Chuva" value={`${w.precipitationMm.toFixed(1)}`} suffix="mm" />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Stat({
  icon, label, value, suffix,
}: { icon: React.ReactNode; label: string; value: string; suffix?: string }) {
  return (
    <div className="flex flex-col items-start">
      <span className="flex items-center gap-1 text-[var(--ink-muted)] uppercase tracking-wider text-[10px] font-bold">
        {icon}{label}
      </span>
      <span className="font-mono-num font-extrabold text-[var(--ink)] text-[14px] leading-tight mt-0.5">
        {value}{suffix && <span className="text-[var(--ink-muted)] text-[10px] ml-0.5 font-bold">{suffix}</span>}
      </span>
    </div>
  );
}

function LayerButton({
  active, onClick, icon, label,
}: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] uppercase tracking-[0.16em] font-extrabold transition-colors ${
        active
          ? 'bg-[var(--ink)] text-[var(--accent)]'
          : 'bg-[var(--surface)] text-[var(--ink)] hover:bg-[var(--bg-soft)]'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
