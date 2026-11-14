import { AlertOctagon, AlertTriangle, FileText, Info } from 'lucide-react';
import type { AlertEvidence, AlertItem } from '../api/types';
import { severityRank, severityStyle } from '../lib/format';
import { lookupValue } from '../lib/lookup';

interface AlertCardProps {
  alert: AlertItem;
  compact?: boolean;
}

const SEVERITY_ICONS: Record<string, typeof Info> = {
  CRITICAL: AlertOctagon,
  HIGH: AlertTriangle,
  MEDIUM: AlertTriangle,
};

function SeverityIcon({ severity }: { severity: string }) {
  const Icon = lookupValue(SEVERITY_ICONS, String(severity ?? '').toUpperCase(), Info);
  return <Icon className="h-4 w-4" />;
}

function AlertTitleRow({ alert }: { alert: AlertItem }) {
  const style = severityStyle(alert.severity);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <h4 className="text-sm font-semibold text-base-content">{alert.title}</h4>
      <span className={`badge badge-sm ${style.badge} font-medium`}>{style.label}</span>
      {alert.category ? (
        <span className="badge badge-sm badge-ghost uppercase tracking-wide">{alert.category}</span>
      ) : null}
    </div>
  );
}

function AlertMessage({ message }: { message?: string | null }) {
  if (!message) return null;
  return <p className="mt-1 text-sm leading-relaxed text-base-content/70">{message}</p>;
}

function AlertActionNote({ action }: { action?: string | null }) {
  if (!action) return null;
  return (
    <p className="mt-2 rounded-lg bg-base-100/70 px-3 py-2 text-xs text-base-content/70">
      <span className="font-semibold text-base-content/80">Acción: </span>
      {action}
    </p>
  );
}

function evidenceLabel(item: AlertEvidence | string): string {
  if (typeof item === 'string') return item;
  const parts = [item.entity, item.id, item.source_ref].filter(Boolean).join(' · ');
  return parts || JSON.stringify(item);
}

function AlertEvidenceList({ evidence }: { evidence: Array<AlertEvidence | string> }) {
  if (evidence.length === 0) return null;
  return (
    <details className="mt-2 group">
      <summary className="inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-base-content/50 hover:text-secondary">
        <FileText className="h-3.5 w-3.5" />
        Evidencia ({evidence.length})
      </summary>
      <ul className="mt-2 space-y-1">
        {evidence.slice(0, 4).map((item, index) => (
          <li key={index} className="font-mono text-[11px] leading-snug text-base-content/50">
            {evidenceLabel(item)}
          </li>
        ))}
      </ul>
    </details>
  );
}

export function AlertCard({ alert, compact = false }: AlertCardProps) {
  const style = severityStyle(alert.severity);
  const evidence = compact ? [] : (alert.evidence ?? []).filter(Boolean);
  const action = compact ? null : alert.action;

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
          <AlertTitleRow alert={alert} />
          <AlertMessage message={alert.message} />
          <AlertActionNote action={action} />
          <AlertEvidenceList evidence={evidence} />
        </div>
      </header>
    </article>
  );
}

export function sortAlerts(alerts: AlertItem[] | null | undefined): AlertItem[] {
  return [...(alerts ?? [])].sort((a, b) => severityRank(a.severity) - severityRank(b.severity));
}

export default AlertCard;
