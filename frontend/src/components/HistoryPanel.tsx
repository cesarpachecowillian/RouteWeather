import { Car, Bike, Bus, PersonStanding, Footprints, History, RotateCcw } from 'lucide-react';
import type { HistoryItem } from '../services/history';
import type { TravelMode } from '../types/trip';

const MODE_ICON: Record<TravelMode, typeof Car> = {
  DRIVE: Car,
  TWO_WHEELER: Bike,
  TRANSIT: Bus,
  BICYCLE: PersonStanding,
  WALK: Footprints,
};

const MODE_LABEL: Record<TravelMode, string> = {
  DRIVE: 'Carro',
  TWO_WHEELER: 'Moto',
  TRANSIT: 'Ônibus',
  BICYCLE: 'Bicicleta',
  WALK: 'A pé',
};

interface Props {
  items: HistoryItem[];
  onReplay: (item: HistoryItem) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
  disabled?: boolean;
}

function relTime(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.round(diff / 60000);
  if (m < 1) return 'agora';
  if (m < 60) return `${m}min`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.round(h / 24);
  return `${d}d`;
}

export function HistoryPanel({ items, onReplay, onClear, disabled }: Props) {
  if (items.length === 0) {
    return (
      <div className="text-center py-6 text-[var(--ink-faint)]">
        <History className="w-7 h-7 mx-auto mb-2 opacity-60" strokeWidth={1.5} />
        <p className="text-[10px] uppercase tracking-[0.18em] font-bold">Sem histórico ainda</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 label">
          <History className="w-3 h-3" />
          Histórico
          <span className="text-[var(--ink-faint)] font-mono-num">· {items.length}</span>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="text-[10px] uppercase tracking-[0.16em] font-bold text-[var(--ink-muted)] hover:text-[var(--danger)] transition-colors"
        >
          Limpar
        </button>
      </div>
      <ul className="space-y-1.5">
        {items.map((item) => {
          const Icon = MODE_ICON[item.travelMode];
          return (
            <li
              key={item.id}
              className="group bg-[var(--surface)] border-2 border-[var(--ink)] hover:bg-[var(--accent-soft)] transition-colors"
            >
              <button
                type="button"
                onClick={() => onReplay(item)}
                disabled={disabled}
                className="w-full text-left px-2.5 py-2 flex items-center gap-2.5 disabled:cursor-not-allowed disabled:opacity-50"
                title="Refazer este cálculo"
              >
                <div className="shrink-0 w-7 h-7 bg-[var(--ink)] flex items-center justify-center text-[var(--accent)]">
                  <Icon className="w-3.5 h-3.5" strokeWidth={2.4} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1 text-[11px] text-[var(--ink)] leading-tight">
                    <span className="truncate font-semibold" title={item.origin}>{item.origin}</span>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-[var(--ink-soft)] leading-tight">
                    <span className="text-[var(--accent)] mr-0.5 font-bold">→</span>
                    <span className="truncate" title={item.destination}>{item.destination}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[9px] uppercase tracking-[0.14em] text-[var(--ink-muted)] mt-0.5 font-mono-num font-bold">
                    <span>{MODE_LABEL[item.travelMode]}</span>
                    {item.distanceKm !== undefined && <span>· {item.distanceKm.toFixed(0)}KM</span>}
                    <span className="ml-auto">{relTime(item.savedAt)}</span>
                  </div>
                </div>
                <RotateCcw className="w-3.5 h-3.5 text-[var(--ink-muted)] opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
