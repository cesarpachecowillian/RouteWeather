import { useEffect, useRef, useState } from 'react';
import {
  Compass, Route as RouteIcon, Clock, ArrowRight, Map as MapIcon,
  ListChecks, Split, History as HistoryIcon,
  Sun, Cloud, CloudFog, CloudDrizzle, CloudRain,
  CloudSnow, CloudLightning,
} from 'lucide-react';

const COND_ICONS: Record<string, typeof Sun> = {
  sunny: Sun, cloudy: Cloud, foggy: CloudFog,
  drizzle: CloudDrizzle, rainy: CloudRain, showers: CloudRain,
  snowy: CloudSnow, thunderstorm: CloudLightning,
};

function uniqueConditions(waypoints: { weather: { icon: string; conditionLabel: string } | null }[]) {
  const seen = new Map<string, { icon: string; label: string }>();
  for (const w of waypoints) {
    if (!w.weather) continue;
    if (!seen.has(w.weather.icon)) {
      seen.set(w.weather.icon, { icon: w.weather.icon, label: w.weather.conditionLabel });
    }
  }
  return Array.from(seen.values());
}
import { TripForm, type FormDefaults } from './components/TripForm';
import { LoadingSpinner } from './components/LoadingSpinner';
import { MapAlertOverlay } from './components/MapAlertOverlay';
import { RouteMap } from './components/RouteMap';
import { WeatherTimeline } from './components/WeatherTimeline';
import { HistoryPanel } from './components/HistoryPanel';
import { RouteAlternatives } from './components/RouteAlternatives';
import { computeTrip } from './services/tripApi';
import {
  loadHistory, saveToHistory, removeFromHistory, clearHistory,
  type HistoryItem,
} from './services/history';
import type { TripRequest, TripResponse } from './types/trip';

type TabId = 'summary' | 'alternatives' | 'history';

function formatTime(iso?: string) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(iso?: string) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

function toLocalInput(iso: string): string {
  return iso.slice(0, 16);
}

export default function App() {
  const [trips, setTrips] = useState<TripResponse[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [defaults, setDefaults] = useState<FormDefaults | undefined>(undefined);
  const [activeTab, setActiveTab] = useState<TabId>('summary');
  const [focusedIdx, setFocusedIdx] = useState<number | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const cancelledRef = useRef(false);
  const previousRef = useRef<{ trips: TripResponse[]; selectedIdx: number } | null>(null);

  const trip = trips[selectedIdx] ?? null;

  useEffect(() => { setHistory(loadHistory()); }, []);

  // Reset map focus when trips change or user picks another alternative
  useEffect(() => {
    setFocusedIdx(null);
  }, [trips, selectedIdx]);

  function restorePrevious() {
    const prev = previousRef.current;
    if (prev) {
      setTrips(prev.trips);
      setSelectedIdx(prev.selectedIdx);
    }
    previousRef.current = null;
  }

  async function handleSubmit(req: TripRequest) {
    if (loading) return;
    previousRef.current = { trips, selectedIdx };
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    cancelledRef.current = false;
    setLoading(true);
    setError(null);
    setTrips([]);
    setSelectedIdx(0);
    try {
      const results = await computeTrip(req, ctrl.signal);
      if (cancelledRef.current) {
        restorePrevious();
        return;
      }
      setTrips(results);
      setSelectedIdx(0);
      const first = results[0];
      const time = req.departureTime ?? req.arrivalTime!;
      const next = saveToHistory({
        origin: req.origin,
        destination: req.destination,
        travelMode: req.travelMode,
        timeMode: req.departureTime ? 'departure' : 'arrival',
        time: toLocalInput(time),
        distanceKm: first.totalDistanceKm,
        durationMinutes: first.totalDurationMinutes,
      });
      setHistory(next);
      previousRef.current = null;
    } catch (e: any) {
      if (cancelledRef.current) {
        restorePrevious();
        return;
      }
      const apiMsg = e?.response?.data?.error;
      setError(apiMsg || 'Não foi possível calcular a rota. Tente novamente.');
      previousRef.current = null;
    } finally {
      setLoading(false);
      abortRef.current = null;
      cancelledRef.current = false;
    }
  }

  function handleCancel() {
    if (!abortRef.current) return;
    cancelledRef.current = true;
    abortRef.current.abort();
    // Immediate restore so the UI doesn't wait for axios to settle
    setLoading(false);
    restorePrevious();
    abortRef.current = null;
  }

  function handleReplay(item: HistoryItem) {
    if (loading) return;
    // Fill the form only — user must click "Traçar rota" to fetch
    setDefaults({
      origin: item.origin,
      destination: item.destination,
      travelMode: item.travelMode,
      timeMode: item.timeMode,
      time: item.time,
    });
  }

  return (
    <div className="h-screen flex flex-col bg-[var(--bg)] text-[var(--ink)] overflow-hidden">
      <header className="h-14 shrink-0 bg-[var(--surface)] border-b-2 border-[var(--ink)] px-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-[var(--accent)] border-2 border-[var(--ink)] flex items-center justify-center shadow-pop-sm">
            <Compass className="w-5 h-5 text-white" strokeWidth={2.4} />
          </div>
          <div className="leading-none">
            <h1 className="font-display text-[19px] font-bold tracking-tight">
              Route<span className="text-[var(--accent)]">Weather</span>
            </h1>
            <p className="text-[9px] uppercase tracking-[0.28em] text-[var(--ink-muted)] mt-1 font-bold">
              Atlas climático para viagens
            </p>
          </div>
        </div>
        <div className="hidden md:flex items-center gap-2">
          <Pill>Google Routes</Pill>
          <Pill>Open-Meteo</Pill>
          <Pill>OpenStreetMap</Pill>
        </div>
      </header>

      <main className="flex-1 grid grid-cols-1 lg:grid-cols-[340px_1fr] overflow-hidden">
        <aside className="bg-[var(--surface)] border-r-2 border-[var(--ink)] flex flex-col overflow-hidden">
          <div className="px-4 py-2.5 border-b-2 border-[var(--ink)] bg-[var(--bg-soft)] flex items-center justify-between">
            <h2 className="label">Plano de viagem</h2>
            <span className="text-[10px] font-mono-num font-bold text-[var(--ink-muted)]">01</span>
          </div>
          <div className="px-4 py-4 border-b-2 border-[var(--ink)]">
            <TripForm
              onSubmit={handleSubmit}
              onCancel={handleCancel}
              loading={loading}
              defaults={defaults}
            />
          </div>

          {error && (
            <div className="mx-4 mt-4 border-2 border-[var(--danger)] bg-white p-3">
              <p className="font-extrabold text-[10px] uppercase tracking-[0.2em] mb-1 text-[var(--danger)]">Erro</p>
              <p className="text-[12px] text-[var(--ink)]">{error}</p>
            </div>
          )}

          <div className="flex border-b-2 border-[var(--ink)] bg-[var(--bg-soft)]">
            <TabButton
              active={activeTab === 'summary'}
              onClick={() => setActiveTab('summary')}
              icon={<ListChecks className="w-3.5 h-3.5" strokeWidth={2.4} />}
              label="Resumo"
              disabled={!trip}
            />
            <TabButton
              active={activeTab === 'alternatives'}
              onClick={() => setActiveTab('alternatives')}
              icon={<Split className="w-3.5 h-3.5" strokeWidth={2.4} />}
              label="Rotas"
              count={trips.length || undefined}
              disabled={trips.length === 0}
            />
            <TabButton
              active={activeTab === 'history'}
              onClick={() => setActiveTab('history')}
              icon={<HistoryIcon className="w-3.5 h-3.5" strokeWidth={2.4} />}
              label="Histórico"
              count={history.length || undefined}
            />
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {activeTab === 'summary' && (
              trip ? <TripSummary trip={trip} /> : <EmptyTabState text="Calcule uma rota para ver o resumo." />
            )}
            {activeTab === 'alternatives' && (
              trips.length > 0
                ? <RouteAlternatives trips={trips} selectedIdx={selectedIdx} onSelect={setSelectedIdx} disabled={loading} />
                : <EmptyTabState text="As alternativas aparecem aqui depois do cálculo." />
            )}
            {activeTab === 'history' && (
              <HistoryPanel
                items={history}
                onReplay={handleReplay}
                onRemove={(id) => setHistory(removeFromHistory(id))}
                onClear={() => setHistory(clearHistory())}
                disabled={loading}
              />
            )}
          </div>
        </aside>

        <section className="flex flex-col overflow-hidden">
          <div className="flex-1 grid grid-rows-[1fr_260px] overflow-hidden">
            <div className="relative overflow-hidden border-b-2 border-[var(--ink)] bg-[var(--bg-soft)]">
              <RouteMap
                waypoints={loading ? undefined : trip?.waypoints}
                encodedPolyline={loading ? undefined : trip?.encodedPolyline}
                loading={loading}
                focusedIdx={focusedIdx}
                onWaypointClick={(idx) => setFocusedIdx(idx)}
              />
              {trip && !loading && trip.alerts.length > 0 && (
                <MapAlertOverlay
                  alerts={trip.alerts}
                  onAlertClick={(idx) => setFocusedIdx(idx)}
                />
              )}
            </div>

            <div className="relative bg-[var(--surface)] overflow-hidden">
              {trip && !loading && (
                <WeatherTimeline
                  waypoints={trip.waypoints}
                  focusedIdx={focusedIdx}
                  onCardClick={(i) => setFocusedIdx(i)}
                />
              )}
              {!trip && !loading && (
                <EmptyPanel small title="Boletim por trecho" subtitle="aguardando cálculo" />
              )}
              {loading && <LoadingPane label="Lendo o tempo" />}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function TabButton({
  active, onClick, icon, label, count, disabled,
}: {
  active: boolean; onClick: () => void; icon: React.ReactNode; label: string; count?: number; disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex-1 px-2 py-2 flex items-center justify-center gap-1.5 text-[10px] uppercase tracking-[0.16em] font-extrabold border-r-2 last:border-r-0 border-[var(--ink)] transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        active
          ? 'bg-[var(--ink)] text-[var(--accent)]'
          : 'bg-[var(--surface)] text-[var(--ink)] hover:bg-[var(--bg-soft)]'
      }`}
    >
      {icon}
      <span>{label}</span>
      {count !== undefined && (
        <span className={`font-mono-num text-[10px] ${active ? 'text-white' : 'text-[var(--ink-muted)]'}`}>
          {count}
        </span>
      )}
    </button>
  );
}

function EmptyTabState({ text }: { text: string }) {
  return (
    <div className="text-center py-10 text-[var(--ink-muted)] text-[11px] uppercase tracking-[0.16em] font-bold">
      {text}
    </div>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[9px] uppercase tracking-[0.18em] font-bold border-2 border-[var(--ink)] px-2 py-1 bg-[var(--surface)]">
      {children}
    </span>
  );
}

function LoadingPane({ label }: { label: string }) {
  return (
    <div className="absolute inset-0 z-[600] bg-[var(--bg)]/90 backdrop-blur-sm flex flex-col items-center justify-center">
      <div className="absolute top-0 left-0 right-0 h-1 loading-bar" />
      <LoadingSpinner label={label} />
      <div className="absolute bottom-0 left-0 right-0 h-1 loading-bar" />
    </div>
  );
}

function EmptyPanel({
  icon, title, subtitle, small,
}: { icon?: React.ReactNode; title: string; subtitle: string; small?: boolean }) {
  return (
    <div className="h-full flex items-center justify-center text-[var(--ink-muted)] relative">
      <div className="text-center">
        {icon && <div className="mx-auto mb-3 opacity-50 flex justify-center">{icon}</div>}
        <p className={`font-display font-bold text-[var(--ink)] ${small ? 'text-sm' : 'text-base'}`}>{title}</p>
        <p className="text-[10px] uppercase tracking-[0.22em] mt-1.5 font-bold">{subtitle}</p>
      </div>
    </div>
  );
}

function TripSummary({ trip }: { trip: TripResponse }) {
  const hours = Math.floor(trip.totalDurationMinutes / 60);
  const minutes = trip.totalDurationMinutes % 60;
  const conditions = uniqueConditions(trip.waypoints);
  return (
    <div className="space-y-3">
      {conditions.length > 0 && (
        <div className="border-2 border-[var(--ink)] bg-[var(--accent)] text-[var(--bg)]">
          <p className="px-3 pt-2 text-[10px] font-extrabold uppercase tracking-[0.2em]">
            Na sua viagem você vai pegar
          </p>
          <div className="px-3 pb-2.5 pt-1.5 flex flex-wrap gap-x-3 gap-y-1.5">
            {conditions.map((c) => {
              const Icon = COND_ICONS[c.icon] ?? Cloud;
              return (
                <span key={c.icon} className="flex items-center gap-1.5 text-[12px] font-extrabold uppercase tracking-wide">
                  <Icon className="w-3.5 h-3.5" strokeWidth={2.4} />
                  {c.label}
                </span>
              );
            })}
          </div>
        </div>
      )}
      <div className="border-2 border-[var(--ink)] bg-[var(--surface)] shadow-pop-sm">
        <div className="px-3 py-2.5 space-y-1.5 border-b-2 border-[var(--ink)]">
          <div className="flex items-start gap-2">
            <span className="mt-1.5 w-2 h-2 rounded-full bg-[var(--success)] shrink-0 ring-2 ring-[var(--success)]/25" />
            <p className="text-[12px] font-semibold leading-snug break-words text-[var(--ink)]" title={trip.origin}>
              {trip.origin}
            </p>
          </div>
          <div className="ml-[3px] border-l-2 border-dotted border-[var(--ink)] h-3" />
          <div className="flex items-start gap-2">
            <span className="mt-1.5 w-2 h-2 rounded-full bg-[var(--accent)] shrink-0 ring-2 ring-[var(--accent)]/25" />
            <p className="text-[12px] font-semibold leading-snug break-words text-[var(--ink)]" title={trip.destination}>
              {trip.destination}
            </p>
          </div>
        </div>

        {trip.description && (
          <div className="px-3 py-1.5 border-b-2 border-[var(--ink)] bg-[var(--bg-soft)]">
            <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--ink-muted)] font-bold">Trajeto</p>
            <p className="font-display text-[13px] font-bold text-[var(--ink)] leading-snug">
              {trip.description}
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 divide-x-2 divide-[var(--ink)]">
          <div className="p-2.5">
            <div className="flex items-center gap-1 text-[9px] uppercase tracking-[0.18em] text-[var(--ink-muted)] font-bold">
              <RouteIcon className="w-2.5 h-2.5" /> Distância
            </div>
            <p className="font-mono-num font-extrabold text-xl text-[var(--ink)] mt-0.5 leading-none">
              {trip.totalDistanceKm.toFixed(0)}
              <span className="text-[10px] ml-1 text-[var(--ink-muted)]">KM</span>
            </p>
          </div>
          <div className="p-2.5">
            <div className="flex items-center gap-1 text-[9px] uppercase tracking-[0.18em] text-[var(--ink-muted)] font-bold">
              <Clock className="w-2.5 h-2.5" /> Duração
            </div>
            <p className="font-mono-num font-extrabold text-xl text-[var(--ink)] mt-0.5 leading-none">
              {hours > 0 && <>{hours}<span className="text-[10px] ml-0.5 text-[var(--ink-muted)]">H</span> </>}
              {minutes}<span className="text-[10px] ml-0.5 text-[var(--ink-muted)]">M</span>
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-stretch border-2 border-[var(--ink)] bg-[var(--bg-soft)]">
        <div className="flex-1 p-2 text-center">
          <p className="text-[9px] uppercase tracking-[0.18em] text-[var(--ink-muted)] font-bold">Partida</p>
          <p className="font-mono-num font-extrabold text-[var(--ink)] text-[15px] mt-0.5 leading-tight">
            {formatTime(trip.departureTime)}
          </p>
          <p className="text-[9px] text-[var(--ink-muted)] uppercase tracking-wide font-bold">{formatDate(trip.departureTime)}</p>
        </div>
        <div className="flex items-center px-2 text-[var(--accent)]">
          <ArrowRight className="w-3.5 h-3.5" strokeWidth={2.5} />
        </div>
        <div className="flex-1 p-2 text-center">
          <p className="text-[9px] uppercase tracking-[0.18em] text-[var(--ink-muted)] font-bold">Chegada</p>
          <p className="font-mono-num font-extrabold text-[var(--ink)] text-[15px] mt-0.5 leading-tight">
            {formatTime(trip.arrivalTime)}
          </p>
          <p className="text-[9px] text-[var(--ink-muted)] uppercase tracking-wide font-bold">{formatDate(trip.arrivalTime)}</p>
        </div>
      </div>
    </div>
  );
}
