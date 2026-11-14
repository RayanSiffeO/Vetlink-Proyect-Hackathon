import { AlertOctagon, AlertTriangle, FileText, Info } from 'lucide-react';
import type { AlertEvidence, AlertItem } from '../api/types';
import { severityRank, severityStyle } from '../lib/format';
import { lookupValue } from '../lib/lookup';

interface AlertCardProps {
  alert: AlertItem;
  compact?: boolean;
}

interface AlertTone {
  icon: string;
  label: string;
  action: string;
  surface: string;
}

const SEVERITY_ICONS: Record<string, typeof Info> = {
  CRITICAL: AlertOctagon,
  HIGH: AlertTriangle,
  MEDIUM: AlertTriangle,
};

const ALERT_TONES: Record<string, AlertTone> = {
  CRITICAL: {
    icon: 'bg-crit text-white',
    label: 'text-crit',
    action: 'bg-crit-soft/70',
    surface: 'alert-surface-critical',
  },
  HIGH: {
    icon: 'bg-warn text-white',
    label: 'text-warn',
    action: 'bg-warn-soft/70',
    surface: 'alert-surface-high',
  },
  MEDIUM: {
    icon: 'bg-infoblue text-white',
    label: 'text-infoblue',
    action: 'bg-infoblue-soft/70',
    surface: 'alert-surface-medium',
  },
};

const FALLBACK_TONE: AlertTone = {
  icon: 'bg-ink text-white',
  label: 'text-caption',
  action: 'bg-mist',
  surface: 'bg-white',
};

function SeverityIcon({ severity }: { severity: string }) {
  const Icon = lookupValue(SEVERITY_ICONS, String(severity ?? '').toUpperCase(), Info);
  return <Icon className="h-[18px] w-[18px]" />;
}

function toneFor(severity: string | null | undefined): AlertTone {
  return lookupValue(ALERT_TONES, String(severity ?? '').toUpperCase(), FALLBACK_TONE);
}

function EvidenceLabel({ evidence }: { evidence: Array<AlertEvidence | string> }) {
  if (evidence.length === 0) return null;
  return (
    <details className="mt-2.5">
      <summary className="inline-flex cursor-pointer items-center gap-1.5 text-[11px] font-medium text-caption transition duration-200 ease-smooth hover:text-ink">
        <FileText className="h-3.5 w-3.5" aria-hidden="true" />
        Evidencia · {evidence.length}
      </summary>
      <ul className="mt-2 space-y-1 rounded-xl border border-line/70 bg-mist/60 p-2.5">
        {evidence.slice(0, 4).map((item, index) => (
          <li key={index} className="break-words font-mono text-[10px] leading-snug text-caption">
            {typeof item === 'string'
              ? item
              : [item.entity, item.id, item.source_ref].filter(Boolean).join(' · ')}
          </li>
        ))}
      </ul>
    </details>
  );
}

export function AlertCard({ alert, compact = false }: AlertCardProps) {
  const tone = toneFor(alert.severity);
  const style = severityStyle(alert.severity);
  const severity = String(alert.severity ?? '').toUpperCase();
  const evidence = compact ? [] : (alert.evidence ?? []).filter(Boolean);
  const action = compact ? null : alert.action;

  return (
    <article
      className={`group rounded-[20px] border border-line/70 p-4 shadow-soft transition duration-300 ease-smooth hover:-translate-y-0.5 hover:border-line-strong hover:shadow-card ${tone.surface}`}
      data-severity={severity}
    >
      <header className="flex items-start gap-3.5">
        <span
          className={`grid h-10 w-10 shrink-0 place-items-center rounded-[14px] shadow-[inset_0_1px_0_rgba(255,255,255,0.25)] ${tone.icon}`}
          aria-hidden="true"
        >
          <SeverityIcon severity={severity} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`text-[9.5px] font-semibold uppercase tracking-[0.14em] ${tone.label}`}>
              {style.label}
            </span>
            {alert.category ? (
              <span className="rounded-full bg-mist px-2 py-0.5 text-[9px] font-medium uppercase tracking-[0.1em] text-caption">
                {alert.category}
              </span>
            ) : null}
          </div>
          <h4 className="mt-1.5 break-words text-[14.5px] font-medium leading-5 text-ink">
            {alert.title}
          </h4>
          {alert.message ? (
            <p className="mt-1 break-words text-[13px] leading-[19px] text-para">{alert.message}</p>
          ) : null}
          {action ? (
            <div className={`mt-2.5 flex flex-wrap items-baseline gap-x-2 gap-y-1 rounded-xl px-3 py-2 ${tone.action}`}>
              <span className={`text-[9px] font-semibold uppercase tracking-[0.12em] ${tone.label}`}>
                Acción
              </span>
              <span className="min-w-0 flex-1 text-[11.5px] leading-[17px] text-para">{action}</span>
            </div>
          ) : null}
          <EvidenceLabel evidence={evidence} />
        </div>
      </header>
    </article>
  );
}

export function sortAlerts(alerts: AlertItem[] | null | undefined): AlertItem[] {
  return [...(alerts ?? [])].sort((a, b) => severityRank(a.severity) - severityRank(b.severity));
}

export default AlertCard;
