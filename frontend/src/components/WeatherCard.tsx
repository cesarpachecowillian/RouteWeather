import {
  Sun, Cloud, CloudFog, CloudDrizzle, CloudRain,
  CloudSnow, CloudLightning, MapPin,
} from 'lucide-react';
import type { Waypoint } from '../types/trip';
import { formatTime, severityColor } from '../utils/weather';

interface Props {
  wp: Waypoint;
  onClick?: () => void;
  focused?: boolean;
}

const ICONS: Record<string, JSX.Element> = {
  sunny: <Sun className="w-8 h-8" style={{ color: '#d97706' }} />,
  cloudy: <Cloud className="w-8 h-8" style={{ color: '#525252' }} />,
  foggy: <CloudFog className="w-8 h-8" style={{ color: '#737373' }} />,
  drizzle: <CloudDrizzle className="w-8 h-8" style={{ color: '#0369a1' }} />,
  rainy: <CloudRain className="w-8 h-8" style={{ color: '#0040ff' }} />,
  showers: <CloudRain className="w-8 h-8" style={{ color: '#002fbb' }} />,
  snowy: <CloudSnow className="w-8 h-8" style={{ color: '#0ea5e9' }} />,
  thunderstorm: <CloudLightning className="w-8 h-8" style={{ color: '#7c3aed' }} />,
};

export function WeatherCard({ wp, onClick, focused }: Props) {
  const w = wp.weather;
  const icon = w
    ? ICONS[w.icon] ?? <Cloud className="w-8 h-8 text-[var(--ink-muted)]" />
    : <Cloud className="w-8 h-8 text-[var(--ink-faint)]" />;
  const color = severityColor(w);

  return (
    <button
      type="button"
      onClick={onClick}
      title="Focar no mapa"
      className={`shrink-0 w-[210px] bg-[var(--surface)] border-2 border-[var(--ink)] flex flex-col text-left transition-transform ${
        focused
          ? 'shadow-[6px_6px_0_var(--accent)] -translate-y-0.5'
          : 'shadow-pop-sm hover:-translate-y-0.5 hover:shadow-[5px_5px_0_var(--ink)]'
      }`}>
      <div className="px-3 py-1 flex items-center justify-between border-b-2 border-[var(--ink)] bg-[var(--bg-soft)]">
        <span className="font-mono-num text-[10px] font-extrabold tracking-wider text-[var(--ink)]">
          KM {wp.distanceFromStartKm.toFixed(0)}
        </span>
        <span className="font-mono-num text-[11px] font-extrabold text-[var(--accent)]">
          {formatTime(wp.estimatedArrival)}
        </span>
      </div>

      <div className="h-[3px] w-full" style={{ background: color }} />

      <div className="px-3 py-2 flex items-start gap-1.5 border-b border-[var(--line)] min-h-[36px]">
        <MapPin className="w-3 h-3 mt-0.5 shrink-0 text-[var(--accent)]" strokeWidth={2.4} />
        {wp.cityName ? (
          <p
            className="text-[11px] font-bold text-[var(--ink)] leading-tight line-clamp-2 break-words"
            title={wp.cityName}
          >
            {wp.cityName}
          </p>
        ) : (
          <p className="text-[10px] text-[var(--ink-faint)] uppercase tracking-wider font-bold leading-tight">
            Trecho rural
          </p>
        )}
      </div>

      <div className="px-3 py-2 flex items-center gap-2 border-b border-[var(--line)]">
        {icon}
        <div className="min-w-0 flex-1">
          <p className="font-mono-num font-extrabold text-[var(--ink)] text-2xl leading-none">
            {w ? `${w.temperatureCelsius.toFixed(0)}°` : '—'}
          </p>
          <p className="text-[10px] text-[var(--ink-muted)] uppercase tracking-wide font-bold leading-tight mt-0.5 break-words" title={w?.conditionLabel}>
            {w ? w.conditionLabel : 'sem dados'}
          </p>
        </div>
      </div>

      {w && (
        <div className="px-3 py-2 space-y-0.5 text-[11px] font-mono-num">
          <Metric label="Umidade" value={`${w.humidity}%`} />
          <Metric label="Vento" value={`${w.windSpeedKmh.toFixed(0)} km/h`} />
          <Metric label="Chuva" value={`${w.precipitationMm.toFixed(1)} mm`} />
        </div>
      )}
    </button>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-[var(--ink-muted)] uppercase tracking-wider text-[10px] font-bold">
        {label}
      </span>
      <span className="text-[var(--ink)] font-bold tabular-nums">{value}</span>
    </div>
  );
}
