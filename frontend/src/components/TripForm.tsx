import { useEffect, useMemo, useState, FormEvent } from 'react';
import { Car, Bike, Bus, PersonStanding, Footprints, ArrowRight, X } from 'lucide-react';
import type { TravelMode, TripRequest } from '../types/trip';
import type { TimeMode } from '../services/history';
import { AutocompleteInput } from './AutocompleteInput';
import { DateTimePicker } from './DateTimePicker';

export interface FormDefaults {
  origin?: string;
  destination?: string;
  time?: string;
  timeMode?: TimeMode;
  travelMode?: TravelMode;
}

interface Props {
  onSubmit: (req: TripRequest) => void;
  onCancel?: () => void;
  loading: boolean;
  defaults?: FormDefaults;
}

const TRAVEL_MODES: { id: TravelMode; label: string; Icon: typeof Car }[] = [
  { id: 'DRIVE', label: 'Carro', Icon: Car },
  { id: 'TWO_WHEELER', label: 'Moto', Icon: Bike },
  { id: 'TRANSIT', label: 'Ônibus', Icon: Bus },
  { id: 'BICYCLE', label: 'Bicicleta', Icon: PersonStanding },
  { id: 'WALK', label: 'A pé', Icon: Footprints },
];

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}
function toLocalInput(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function defaultTime(): string {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return toLocalInput(d);
}
function nowInputValue(): string {
  return toLocalInput(new Date());
}
function maxInputValue(): string {
  const d = new Date();
  d.setDate(d.getDate() + 14);
  return toLocalInput(d);
}

export function TripForm({ onSubmit, onCancel, loading, defaults }: Props) {
  const [origin, setOrigin] = useState(defaults?.origin ?? '');
  const [destination, setDestination] = useState(defaults?.destination ?? '');
  const [time, setTime] = useState<string>(() =>
    defaults?.time && defaults.time >= nowInputValue() ? defaults.time : defaultTime()
  );
  const [timeMode, setTimeMode] = useState<TimeMode>(defaults?.timeMode ?? 'departure');
  const [travelMode, setTravelMode] = useState<TravelMode>(defaults?.travelMode ?? 'DRIVE');

  useEffect(() => {
    if (!defaults) return;
    if (defaults.origin !== undefined) setOrigin(defaults.origin);
    if (defaults.destination !== undefined) setDestination(defaults.destination);
    if (defaults.timeMode) setTimeMode(defaults.timeMode);
    if (defaults.travelMode) setTravelMode(defaults.travelMode);
    if (defaults.time) {
      setTime(defaults.time >= nowInputValue() ? defaults.time : defaultTime());
    }
  }, [defaults]);

  const min = useMemo(nowInputValue, [time]); // eslint-disable-line react-hooks/exhaustive-deps
  const max = useMemo(maxInputValue, []);

  const validationError = useMemo(() => {
    if (!time) return 'Selecione data e hora';
    if (time < min) {
      return timeMode === 'departure'
        ? 'A partida não pode ser no passado'
        : 'A chegada precisa ser no futuro';
    }
    if (time > max) return 'No máximo 14 dias à frente';
    return null;
  }, [time, min, max, timeMode]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (loading || validationError) return;
    if (!origin.trim() || !destination.trim() || !time) return;
    const isoTime = `${time}:00`;
    onSubmit({
      origin: origin.trim(),
      destination: destination.trim(),
      travelMode,
      ...(timeMode === 'departure'
        ? { departureTime: isoTime }
        : { arrivalTime: isoTime }),
    });
  };

  const activeModeLabel = TRAVEL_MODES.find((m) => m.id === travelMode)?.label ?? '';

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field label="Origem">
        <AutocompleteInput value={origin} onChange={setOrigin} placeholder="Cidade ou endereço" required disabled={loading} />
      </Field>

      <Field label="Destino">
        <AutocompleteInput value={destination} onChange={setDestination} placeholder="Cidade ou endereço" required disabled={loading} />
      </Field>

      <Field label="Modo de viagem">
        <div className={`flex border-2 ${loading ? 'border-[var(--ink-faint)] opacity-60' : 'border-[var(--ink)]'}`}>
          {TRAVEL_MODES.map(({ id, label, Icon }, idx) => {
            const active = travelMode === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setTravelMode(id)}
                disabled={loading}
                title={label}
                aria-label={label}
                aria-pressed={active}
                className={`flex-1 h-10 flex items-center justify-center transition-colors disabled:cursor-not-allowed ${
                  idx > 0 ? `border-l-2 ${loading ? 'border-[var(--ink-faint)]' : 'border-[var(--ink)]'}` : ''
                } ${
                  active
                    ? loading ? 'bg-[var(--ink-faint)] text-white' : 'bg-[var(--ink)] text-[var(--accent)]'
                    : loading ? 'bg-[var(--bg-soft)] text-[var(--ink-muted)]' : 'bg-[var(--surface)] text-[var(--ink)] hover:bg-[var(--bg-soft)]'
                }`}
              >
                <Icon className="w-4 h-4" strokeWidth={active ? 2.6 : 2} />
              </button>
            );
          })}
        </div>
        <p className="text-[10px] text-[var(--ink-muted)] mt-1.5 uppercase tracking-[0.16em] font-bold">
          Selecionado: <span className="text-[var(--accent)]">{activeModeLabel}</span>
        </p>
      </Field>

      <Field label="Horário">
        <div className={`grid grid-cols-2 mb-1.5 border-2 ${loading ? 'border-[var(--ink-faint)] opacity-60' : 'border-[var(--ink)]'}`}>
          <button
            type="button"
            onClick={() => setTimeMode('departure')}
            disabled={loading}
            className={`py-1.5 text-[10px] font-bold tracking-[0.14em] uppercase transition-colors disabled:cursor-not-allowed ${
              timeMode === 'departure'
                ? loading ? 'bg-[var(--ink-faint)] text-white' : 'bg-[var(--ink)] text-[var(--surface)]'
                : 'bg-[var(--surface)] text-[var(--ink)] hover:bg-[var(--bg-soft)]'
            }`}
          >
            Partir às
          </button>
          <button
            type="button"
            onClick={() => setTimeMode('arrival')}
            disabled={loading}
            className={`py-1.5 text-[10px] font-bold tracking-[0.14em] uppercase border-l-2 transition-colors disabled:cursor-not-allowed ${
              loading ? 'border-[var(--ink-faint)]' : 'border-[var(--ink)]'
            } ${
              timeMode === 'arrival'
                ? loading ? 'bg-[var(--ink-faint)] text-white' : 'bg-[var(--ink)] text-[var(--surface)]'
                : 'bg-[var(--surface)] text-[var(--ink)] hover:bg-[var(--bg-soft)]'
            }`}
          >
            Chegar às
          </button>
        </div>
        <DateTimePicker
          value={time}
          onChange={setTime}
          min={min}
          max={max}
          error={validationError ?? undefined}
          disabled={loading}
        />
      </Field>

      {loading ? (
        <button
          type="button"
          onClick={() => onCancel?.()}
          className="w-full bg-[var(--surface)] hover:bg-[var(--danger)] hover:text-white text-[var(--danger)] font-bold py-3 border-2 border-[var(--danger)] flex items-center justify-center gap-2 transition-colors uppercase tracking-[0.18em] text-[11px] shadow-pop active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
        >
          <X className="w-3.5 h-3.5" strokeWidth={2.8} /> Cancelar
        </button>
      ) : (
        <button
          type="submit"
          disabled={!!validationError || !origin.trim() || !destination.trim()}
          className="w-full bg-[var(--accent)] hover:bg-[var(--accent-strong)] disabled:bg-[var(--bg-soft)] disabled:text-[var(--ink-faint)] disabled:cursor-not-allowed text-white font-bold py-3 border-2 border-[var(--ink)] flex items-center justify-center gap-2 transition-colors uppercase tracking-[0.18em] text-[11px] shadow-pop active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:shadow-none disabled:active:translate-x-0 disabled:active:translate-y-0"
        >
          Traçar rota <ArrowRight className="w-3.5 h-3.5" strokeWidth={2.5} />
        </button>
      )}
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block label">{label}</label>
      {children}
    </div>
  );
}
