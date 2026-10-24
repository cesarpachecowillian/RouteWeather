import type { TravelMode } from '../types/trip';

const KEY = 'rw:history:v1';
const MAX = 12;

export type TimeMode = 'departure' | 'arrival';

export interface HistoryItem {
  id: string;
  savedAt: number;
  origin: string;
  destination: string;
  travelMode: TravelMode;
  timeMode: TimeMode;
  time: string;             // "yyyy-MM-ddTHH:mm"
  distanceKm?: number;
  durationMinutes?: number;
}

function safeParse(): HistoryItem[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function persist(items: HistoryItem[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    /* ignore quota errors */
  }
}

export function loadHistory(): HistoryItem[] {
  return safeParse();
}

export function saveToHistory(item: Omit<HistoryItem, 'id' | 'savedAt'>): HistoryItem[] {
  const list = safeParse();
  const dedupedKey = (i: { origin: string; destination: string; travelMode: string }) =>
    `${i.origin}|${i.destination}|${i.travelMode}`;
  const filtered = list.filter((i) => dedupedKey(i) !== dedupedKey(item));
  const entry: HistoryItem = { ...item, id: crypto.randomUUID(), savedAt: Date.now() };
  const next = [entry, ...filtered].slice(0, MAX);
  persist(next);
  return next;
}

export function removeFromHistory(id: string): HistoryItem[] {
  const next = safeParse().filter((i) => i.id !== id);
  persist(next);
  return next;
}

export function clearHistory(): HistoryItem[] {
  persist([]);
  return [];
}
