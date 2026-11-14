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

const ALERT_SURFACES: Record<string, string> = {
  CRITICAL: 'border-line-strong/80 border-l-crit bg-white',
  HIGH: 'border-line-strong/80 border-l-warn bg-white',
  MEDIUM: 'border-line-strong/80 border-l-infoblue bg-white',
};

const ALERT_ICON_TONES: Record<string, string> = {
  CRITICAL: 'bg-crit-soft text-crit ring-crit/10',
  HIGH: 'bg-warn-soft text-warn ring-warn/10',
  MEDIUM: 'bg-infoblue-soft text-infoblue ring-infoblue/10',
};

const FALLBACK_SURFACE = 'border-line border-l-line-strong bg-white';
const FALLBACK_ICON_TONE = 'bg-mist text-caption ring-line';

function SeverityIcon({ severity }: { severity: string }) {
  const Icon = lookupValue(SEVERITY_ICONS, String(severity ?? '').toUpperCase(), Info);
  return <Icon className="h-4 w-4" />;
}

function toneFor(
  tones: Record<string, string>,
  severity: string | null | undefined,
  fallback: string,
): string {
  return lookupValue(tones, String(severity ?? '').toUpperCase(), fallback);
}

function AlertTitleRow({ alert }: { alert: AlertItem }) {
  const style = severityStyle(alert.severity);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <h4 className="min-w-0 break-words text-[14px] font-medium leading-5 text-ink">
        {alert.title}
      </h4>
      <span className={`badge badge-sm ${style.badge} border-0 font-medium`}>{style.label}</span>
      {alert.category ? (
        <span className="rounded-full border border-line-strong/80 bg-white/60 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] text-caption">
          {alert.category}
        </span>
      ) : null}
    </div>
  );
}

function AlertMessage({ message }: { message?: string | null }) {
  if (!message) return null;
  return <p className="mt-1 break-words text-[13px] leading-[19px] text-para">{message}</p>;
}

function AlertActionNote({ action }: { action?: string | null }) {
  if (!action) return null;
  return (
    <p className="mt-2 break-words rounded-xl bg-mist/80 px-3 py-2 text-[12px] leading-[18px] text-para ring-1 ring-inset ring-line/80">
      <span className="font-semibold text-ink">Acción: </span>
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
      <summary className="inline-flex cursor-pointer items-center gap-1 text-[11.5px] font-medium text-caption hover:text-indigo-700">
        <FileText className="h-3.5 w-3.5" />
        Evidencia ({evidence.length})
      </summary>
      <ul className="mt-2 space-y-1 rounded-xl bg-mist/70 p-2.5">
        {evidence.slice(0, 4).map((item, index) => (
          <li
            key={index}
            className="break-words font-mono text-[10.5px] leading-snug text-caption"
          >
            {evidenceLabel(item)}
          </li>
        ))}
      </ul>
    </details>
  );
}

export function AlertCard({ alert, compact = false }: AlertCardProps) {
  const surface = toneFor(ALERT_SURFACES, alert.severity, FALLBACK_SURFACE);
  const iconTone = toneFor(ALERT_ICON_TONES, alert.severity, FALLBACK_ICON_TONE);
  const evidence = compact ? [] : (alert.evidence ?? []).filter(Boolean);
  const action = compact ? null : alert.action;

  return (
    <article
      className={`rounded-2xl border border-l-[3px] px-4 py-3.5 shadow-[0_10px_22px_-24px_rgba(30,42,35,0.45)] ${surface}`}
      data-severity={String(alert.severity ?? '').toUpperCase()}
    >
      <header className="flex items-start gap-3">
        <span
          className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl ring-1 ring-inset ${iconTone}`}
          aria-hidden="true"
        >
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
