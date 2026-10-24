import { AlertTriangle, X } from 'lucide-react';
import { useState, useEffect } from 'react';

export function AlertBanner({ alerts }: { alerts: string[] }) {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => { setDismissed(false); }, [alerts]);

  if (!alerts || alerts.length === 0 || dismissed) return null;

  return (
    <div className="bg-[var(--ink)] text-white border-b-4 border-[var(--danger)] relative">
      <div className="px-5 py-3 flex items-start gap-3">
        <div className="shrink-0 mt-0.5 bg-[var(--danger)] p-1">
          <AlertTriangle className="w-4 h-4 text-white" strokeWidth={2.6} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-[10px] font-extrabold uppercase tracking-[0.24em] mb-1.5 text-[var(--danger)]">
            ALERTA · {alerts.length} {alerts.length === 1 ? 'aviso' : 'avisos'} na rota
          </h3>
          <ul className="text-[13px] font-medium leading-snug space-y-1 text-white">
            {alerts.map((a, i) => (
              <li key={i} className="flex gap-2.5">
                <span className="font-mono-num text-[var(--danger)] font-bold">{String(i + 1).padStart(2, '0')}</span>
                <span>{a}</span>
              </li>
            ))}
          </ul>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="shrink-0 p-1 hover:bg-white/15 transition-colors"
          aria-label="Fechar alertas"
        >
          <X className="w-4 h-4" strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}
