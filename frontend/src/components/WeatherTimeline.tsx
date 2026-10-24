import { useEffect, useRef } from 'react';
import type { Waypoint } from '../types/trip';
import { WeatherCard } from './WeatherCard';

interface Props {
  waypoints: Waypoint[];
  onCardClick?: (idx: number) => void;
  focusedIdx?: number | null;
}

export function WeatherTimeline({ waypoints, onCardClick, focusedIdx }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const el = scrollRef.current;
    if (!el) return;
    if (e.deltaY === 0) return;
    el.scrollLeft += e.deltaY;
  };

  useEffect(() => {
    if (focusedIdx == null) return;
    const card = cardRefs.current[focusedIdx];
    card?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [focusedIdx]);

  return (
    <div className="h-full flex flex-col bg-[var(--bg-soft)]">
      <div className="px-4 py-2 flex items-center justify-between border-b-2 border-[var(--ink)] bg-[var(--surface)]">
        <h3 className="label">Previsão por trecho</h3>
        <span className="font-mono-num text-[10px] uppercase tracking-[0.18em] font-bold text-[var(--ink-muted)]">
          {waypoints.length} pontos · clique para focar no mapa
        </span>
      </div>
      <div
        ref={scrollRef}
        onWheel={handleWheel}
        className="flex-1 overflow-x-auto overflow-y-hidden"
      >
        <div className="flex gap-3 h-full px-4 py-3 w-max">
          {waypoints.map((wp, i) => (
            <div key={i} ref={(el) => { cardRefs.current[i] = el; }}>
              <WeatherCard
                wp={wp}
                focused={focusedIdx === i}
                onClick={() => onCardClick?.(i)}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
