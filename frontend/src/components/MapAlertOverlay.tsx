import { useEffect, useState } from 'react';
import {
  AlertTriangle, ChevronDown, X, MapPin,
  CloudRain, CloudSnow, CloudLightning, CloudFog,
  Wind, Thermometer, Snowflake, Flame,
} from 'lucide-react';
import type { Alert, AlertType } from '../types/trip';

interface Props {
  alerts: Alert[];
  onAlertClick?: (waypointIdx: number) => void;
}

const TYPE_META: Record<AlertType, { Icon: typeof AlertTriangle; label: string; tone: string }> = {
  RAIN:            { Icon: CloudRain,      label: 'Chuva',           tone: '#2563eb' },
  SNOW:            { Icon: CloudSnow,      label: 'Neve',            tone: '#0ea5e9' },
  FREEZING_PRECIP: { Icon: Snowflake,      label: 'Cong.',           tone: '#0891b2' },
  STORM:           { Icon: CloudLightning, label: 'Tempestade',      tone: '#7c3aed' },
  FOG:             { Icon: CloudFog,       label: 'Neblina',         tone: '#737373' },
  WIND:            { Icon: Wind,           label: 'Vento',           tone: '#ca8a04' },
  HEAT:            { Icon: Flame,          label: 'Calor',           tone: '#dc2626' },
  COLD:            { Icon: Thermometer,    label: 'Frio',            tone: '#0284c7' },
};

const FALLBACK = { Icon: AlertTriangle, label: 'Aviso', tone: '#dc2626' };

function meta(t?: AlertType) {
  return t ? TYPE_META[t] : FALLBACK;
}

export function MapAlertOverlay({ alerts, onAlertClick }: Props) {
  const [open, setOpen] = useState(true);

  useEffect(() => { setOpen(true); }, [alerts]);

  if (!alerts || alerts.length === 0) return null;

  return (
    <div className="absolute top-3 right-3 z-[500] pointer-events-auto">
      {open ? (
        <div
          className="bg-[var(--surface)] border-2 border-[var(--ink)] w-[320px] max-w-[calc(100vw-1.5rem)] overflow-hidden"
          style={{ boxShadow: '5px 5px 0 var(--ink)' }}
        >
          <div className="bg-[var(--ink)] text-[var(--accent)] px-3 py-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.2em]">
              <div className="w-5 h-5 bg-[var(--accent)] text-[var(--ink)] flex items-center justify-center">
                <AlertTriangle className="w-3 h-3" strokeWidth={3} />
              </div>
              Atenção
              <span className="font-mono-num text-white text-[11px]">· {alerts.length}</span>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="hover:text-white transition-colors p-0.5"
              aria-label="Recolher alertas"
            >
              <X className="w-3.5 h-3.5" strokeWidth={2.6} />
            </button>
          </div>

          <ul className="max-h-[42vh] overflow-y-auto divide-y divide-[var(--line)]">
            {alerts.map((a, i) => {
              const m = meta(a.type);
              return (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => onAlertClick?.(a.waypointIndex)}
                    title="Focar no mapa"
                    className="group w-full text-left px-3 py-2.5 flex items-start gap-2.5 text-[12px] text-[var(--ink)] leading-snug hover:bg-[var(--accent-soft)] transition-colors relative"
                  >
                    <span
                      className="absolute left-0 top-0 bottom-0 w-[3px]"
                      style={{ background: m.tone }}
                    />
                    <div
                      className="shrink-0 w-7 h-7 flex items-center justify-center text-white rounded-sm"
                      style={{ background: m.tone }}
                    >
                      <m.Icon className="w-4 h-4" strokeWidth={2.4} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span
                          className="text-[9px] uppercase tracking-[0.18em] font-extrabold"
                          style={{ color: m.tone }}
                        >
                          {m.label}
                        </span>
                        <span className="font-mono-num text-[9px] uppercase tracking-wider text-[var(--ink-faint)]">
                          #{String(i + 1).padStart(2, '0')}
                        </span>
                      </div>
                      <p className="text-[12px] text-[var(--ink)] leading-snug">{a.message}</p>
                    </div>
                    <MapPin className="w-3 h-3 mt-1 shrink-0 text-[var(--ink-faint)] group-hover:text-[var(--accent)] transition-colors" strokeWidth={2.4} />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="bg-[var(--ink)] text-[var(--accent)] border-2 border-[var(--ink)] flex items-center gap-2 px-3 py-1.5 hover:bg-[var(--accent)] hover:text-[var(--ink)] transition-colors"
          style={{ boxShadow: '3px 3px 0 var(--ink)' }}
        >
          <AlertTriangle className="w-3.5 h-3.5" strokeWidth={2.6} />
          <span className="text-[10px] font-extrabold uppercase tracking-[0.18em]">
            {alerts.length} {alerts.length === 1 ? 'alerta' : 'alertas'}
          </span>
          <ChevronDown className="w-3.5 h-3.5" strokeWidth={2.6} />
        </button>
      )}
    </div>
  );
}
