import type { WeatherInfo } from '../types/trip';

export function severityColor(w: WeatherInfo | null): string {
  if (!w) return '#94a3b8';
  const c = w.conditionCode;
  if (c === 0) return '#22c55e';
  if ([1, 2, 3].includes(c)) return '#eab308';
  if ([45, 48, 51, 53, 55].includes(c)) return '#a3a3a3';
  if ([61, 63, 65, 80, 81, 82].includes(c)) return '#ef4444';
  if ([95, 96, 99].includes(c)) return '#7c3aed';
  if ([71, 73, 75].includes(c)) return '#0ea5e9';
  return '#64748b';
}

export function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}
