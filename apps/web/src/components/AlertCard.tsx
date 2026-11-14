import { AlertOctagon, AlertTriangle, FileText, Info } from 'lucide-react';
import type { AlertItem } from '../api/types';
import { severityRank, severityStyle } from '../lib/format';

interface AlertCardProps {
  alert: AlertItem;
  /** Número de evidencias visibles por defecto. */
  compact?: boolean;
}

function SeverityIcon({ severity }: { severity: string }) {
  const value = String(severity ?? '').toUpperCase();
  if (value === 'CRITICAL') return <AlertOctagon className="h-4 w-4" />;
  if (value === 'HIGH') return <AlertTriangle className="h-4 w-4" />;
  if (value === 'MEDIUM') return <AlertTriangle className="h-4 w-4" />;
  return <Info className="h-4 w-4" />;
}

/** Tarjeta de alerta clínica con color por severidad y evidencia de origen. */
export function AlertCard({ alert, compact = false }: AlertCardProps) {
  const style = severityStyle(alert.severity);
  const evidence = (alert.evidence ?? []).filter(Boolean);

  return (
    <article
      className={`rounded-xl border ${style.border} ${style.surface} p-4`}
      data-severity={String(alert.severity ?? '').toUpperCase()}
    >
      <header className="flex items-start gap-3">
        <span className={`mt-0.5 ${style.icon}`} aria-hidden="true">
          <SeverityIcon severity={String(alert.severity ?? '')} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-sm font-semibold text-base-content">{alert.title}</h4>
            <span className={`badge badge-sm ${style.badge} font-medium`}>{style.label}</span>
            {alert.category ? (
              <span className="badge badge-sm badge-ghost uppercase tracking-wide">
                {alert.category}
              </span>
            ) : null}
          </div>
          {alert.message ? (
            <p className="mt-1 text-sm leading-relaxed text-base-content/70">{alert.message}</p>
          ) : null}
          {alert.action && !compact ? (
            <p className="mt-2 rounded-lg bg-base-100/70 px-3 py-2 text-xs text-base-content/70">
              <span className="font-semibold text-base-content/80">Acción: </span>
              {alert.action}
            </p>
          ) : null}
          {evidence.length > 0 && !compact ? (
            <details className="mt-2 group">
              <summary className="inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-base-content/50 hover:text-secondary">
                <FileText className="h-3.5 w-3.5" />
                Evidencia ({evidence.length})
              </summary>
              <ul className="mt-2 space-y-1">
                {evidence.slice(0, 4).map((item, index) => {
                  const label =
                    typeof item === 'string'
                      ? item
                      : [item.entity, item.id, item.source_ref]
                          .filter(Boolean)
                          .join(' · ') || JSON.stringify(item);
                  return (
                    <li key={index} className="font-mono text-[11px] leading-snug text-base-content/50">
                      {label}
                    </li>
                  );
                })}
              </ul>
            </details>
          ) : null}
        </div>
      </header>
    </article>
  );
}

/** Lista ordenada por severidad (crítica → info). */
export function sortAlerts(alerts: AlertItem[] | null | undefined): AlertItem[] {
  return [...(alerts ?? [])].sort((a, b) => severityRank(a.severity) - severityRank(b.severity));
}

export default AlertCard;
