import { useEffect, useRef, useState } from 'react';
import { Loader2, MapPin } from 'lucide-react';
import { autocompletePlaces, type PlaceSuggestion } from '../services/places';

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
}

export function AutocompleteInput({ value, onChange, placeholder, required, disabled }: Props) {
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const skipNextFetch = useRef(false);
  const lastUserValue = useRef<string>(value);
  const reqId = useRef(0);

  useEffect(() => {
    if (skipNextFetch.current) {
      skipNextFetch.current = false;
      lastUserValue.current = value;
      return;
    }
    // External change (e.g. parent set value from history): don't open suggestions
    if (value !== lastUserValue.current) {
      lastUserValue.current = value;
      setSuggestions([]);
      setOpen(false);
      setLoading(false);
      return;
    }
    if (!value || value.trim().length < 2) {
      setSuggestions([]);
      setOpen(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    const myId = ++reqId.current;
    const t = setTimeout(async () => {
      try {
        const res = await autocompletePlaces(value);
        if (reqId.current !== myId) return;
        setSuggestions(res);
        setOpen(true);
        setHighlight(-1);
      } catch {
        if (reqId.current !== myId) return;
        setSuggestions([]);
        setOpen(false);
      } finally {
        if (reqId.current === myId) setLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [value]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const select = (s: PlaceSuggestion) => {
    skipNextFetch.current = true;
    onChange(s.displayName);
    setOpen(false);
    setSuggestions([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => (h + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => (h <= 0 ? suggestions.length - 1 : h - 1));
    } else if (e.key === 'Enter' && highlight >= 0) {
      e.preventDefault();
      select(suggestions[highlight]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const showLoadingPanel = loading && (suggestions.length === 0 || !open);

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={(e) => { lastUserValue.current = e.target.value; onChange(e.target.value); }}
          onKeyDown={handleKeyDown}
          onFocus={() => (suggestions.length > 0 || loading) && setOpen(true)}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          autoComplete="off"
          className="w-full pl-9 pr-9 py-2.5 bg-[var(--surface)] border-2 border-[var(--ink)] rounded-none text-[13px] text-[var(--ink)] placeholder:text-[var(--ink-faint)] focus:outline-none focus:bg-[var(--accent-soft)] transition-colors font-medium disabled:bg-[var(--bg-soft)] disabled:text-[var(--ink-muted)] disabled:cursor-not-allowed"
        />
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--ink)] pointer-events-none" strokeWidth={2.2} />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--accent)] animate-spin" />
        )}
      </div>

      {(open || showLoadingPanel) && (
        <ul className="absolute z-30 w-full mt-1 bg-[var(--surface)] border-2 border-[var(--ink)] shadow-pop max-h-64 overflow-auto">
          {loading && suggestions.length === 0 && (
            <li className="px-3 py-3 text-[12px] text-[var(--ink-muted)] flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--accent)]" />
              <span className="uppercase tracking-[0.18em] text-[10px] font-bold">Buscando lugares</span>
            </li>
          )}
          {!loading && suggestions.length === 0 && value.trim().length >= 2 && (
            <li className="px-3 py-3 uppercase tracking-[0.18em] text-[10px] font-bold text-[var(--ink-faint)]">
              Nenhum lugar encontrado
            </li>
          )}
          {suggestions.map((s, i) => (
            <li
              key={`${s.lat}-${s.lng}-${i}`}
              onMouseDown={(e) => { e.preventDefault(); select(s); }}
              onMouseEnter={() => setHighlight(i)}
              className={`px-3 py-2 text-[13px] cursor-pointer flex items-start gap-2 border-b border-[var(--line)] last:border-b-0 ${
                i === highlight ? 'bg-[var(--accent)] text-white' : 'text-[var(--ink)] hover:bg-[var(--bg-soft)]'
              }`}
            >
              <MapPin className={`w-3 h-3 mt-1 shrink-0 ${i === highlight ? 'text-white' : 'opacity-50'}`} />
              <span className="leading-snug">{s.displayName}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
