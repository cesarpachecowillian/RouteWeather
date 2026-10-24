import { Clock, Check, Route as RouteIcon } from 'lucide-react';
import type { TripResponse } from '../types/trip';

interface Props {
  trips: TripResponse[];
  selectedIdx: number;
  onSelect: (i: number) => void;
  disabled?: boolean;
}

function durationLabel(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
}

export function RouteAlternatives({ trips, selectedIdx, onSelect, disabled }: Props) {
  if (!trips || trips.length === 0) return null;

  const fastest = trips.reduce((min, t, i, arr) =>
    t.totalDurationMinutes < arr[min].totalDurationMinutes ? i : min, 0);
  const shortest = trips.reduce((min, t, i, arr) =>
    t.totalDistanceKm < arr[min].totalDistanceKm ? i : min, 0);

  return (
    <ul className="space-y-1.5">
      {trips.map((t, i) => {
        const active = i === selectedIdx;
        const tags: string[] = [];
        if (i === fastest) tags.push('Mais rápida');
        if (i === shortest && shortest !== fastest) tags.push('Mais curta');
        const label = `Rota ${String(i + 1).padStart(2, '0')}`;
        return (
          <li key={i}>
            <button
              type="button"
              onClick={() => onSelect(i)}
              disabled={disabled}
              className={`w-full text-left border-2 px-3 py-2.5 transition-colors flex items-start gap-3 disabled:cursor-not-allowed disabled:opacity-60 ${
                active
                  ? 'border-[var(--ink)] bg-[var(--accent)] text-white shadow-pop-sm'
                  : 'border-[var(--ink)] bg-[var(--surface)] text-[var(--ink)] hover:bg-[var(--accent-soft)]'
              }`}
            >
              <div className={`shrink-0 w-7 h-7 flex items-center justify-center font-mono-num font-extrabold text-[11px] border-2 ${
                active
                  ? 'bg-white text-[var(--accent)] border-white'
                  : 'bg-[var(--ink)] text-[var(--accent)] border-[var(--ink)]'
              }`}>
                {active ? <Check className="w-4 h-4" strokeWidth={3} /> : String(i + 1).padStart(2, '0')}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2 mb-0.5">
                  <span className="text-[10px] uppercase tracking-[0.16em] font-extrabold opacity-80">
                    {label}
                  </span>
                  <span className="text-[11px] font-mono-num font-extrabold flex items-center gap-1 shrink-0">
                    <Clock className="w-3 h-3" strokeWidth={2.4} />
                    {durationLabel(t.totalDurationMinutes)}
                  </span>
                </div>
                <p className={`font-display text-[13px] font-bold leading-snug break-words ${active ? 'text-white' : 'text-[var(--ink)]'}`}>
                  {t.description ?? 'Trajeto direto'}
                </p>
                <div className="flex items-center justify-between gap-2 mt-1">
                  <span className="text-[11px] font-mono-num font-bold flex items-center gap-1 opacity-90">
                    <RouteIcon className="w-3 h-3" strokeWidth={2.4} />
                    {t.totalDistanceKm.toFixed(0)} KM
                  </span>
                  {tags.length > 0 && (
                    <div className="flex gap-1">
                      {tags.map((tag) => (
                        <span
                          key={tag}
                          className={`text-[9px] uppercase tracking-[0.14em] font-bold px-1.5 py-0.5 ${
                            active ? 'bg-white/20 text-white' : 'bg-[var(--ink)] text-[var(--accent)]'
                          }`}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
