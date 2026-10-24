import { Compass } from 'lucide-react';

export function LoadingSpinner({ label = 'Carregando' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 text-[var(--ink)]">
      <div className="relative">
        <div className="w-12 h-12 border-2 border-[var(--ink)] bg-[var(--surface)] flex items-center justify-center shadow-pop-sm">
          <Compass className="w-6 h-6 text-[var(--accent)] animate-spin" style={{ animationDuration: '2.4s' }} strokeWidth={2.2} />
        </div>
      </div>
      <p className="text-[10px] uppercase tracking-[0.24em] font-extrabold">
        {label} <span className="blink text-[var(--accent)]">●</span>
      </p>
    </div>
  );
}
