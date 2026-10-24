import { useMemo } from 'react';
import { Calendar, Clock } from 'lucide-react';

interface Props {
  value: string;
  onChange: (v: string) => void;
  min?: string;
  max?: string;
  error?: string;
  disabled?: boolean;
}

function splitDateTime(v: string): { date: string; time: string } {
  if (!v) return { date: '', time: '' };
  const [date, time = ''] = v.split('T');
  return { date, time: time.slice(0, 5) };
}

function combine(date: string, time: string): string {
  if (!date) return '';
  return `${date}T${time || '00:00'}`;
}

export function DateTimePicker({ value, onChange, min, max, error, disabled }: Props) {
  const { date, time } = useMemo(() => splitDateTime(value), [value]);
  const minSplit = useMemo(() => splitDateTime(min || ''), [min]);
  const maxSplit = useMemo(() => splitDateTime(max || ''), [max]);

  const setDate = (d: string) => onChange(combine(d, time));
  const setTime = (t: string) => onChange(combine(date, t));

  return (
    <div className="space-y-1">
      <div
        className={`flex items-stretch border-2 transition-colors ${
          disabled
            ? 'bg-[var(--bg-soft)] border-[var(--ink-faint)]'
            : `bg-[var(--surface)] focus-within:bg-[var(--accent-soft)] ${
                error ? 'border-[var(--danger)]' : 'border-[var(--ink)]'
              }`
        }`}
      >
        <label className={`flex-1 flex items-center gap-2 px-3 py-2.5 ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
          <Calendar className="w-3.5 h-3.5 shrink-0" strokeWidth={2.2} />
          <input
            type="date"
            value={date}
            min={minSplit.date || undefined}
            max={maxSplit.date || undefined}
            onChange={(e) => setDate(e.target.value)}
            required
            disabled={disabled}
            className="flex-1 bg-transparent text-[13px] outline-none cursor-pointer font-mono-num font-semibold disabled:cursor-not-allowed disabled:text-[var(--ink-muted)]"
          />
        </label>
        <div className={`w-[1.5px] ${disabled ? 'bg-[var(--ink-faint)]' : 'bg-[var(--ink)]'}`} />
        <label className={`w-[100px] flex items-center gap-2 px-3 py-2.5 ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
          <Clock className="w-3.5 h-3.5 shrink-0" strokeWidth={2.2} />
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            required
            disabled={disabled}
            className="w-full bg-transparent text-[13px] outline-none cursor-pointer font-mono-num font-semibold disabled:cursor-not-allowed disabled:text-[var(--ink-muted)]"
          />
        </label>
      </div>
      {error && <p className="text-[10px] text-[var(--danger)] mt-0.5 uppercase tracking-[0.16em] font-bold">{error}</p>}
    </div>
  );
}
