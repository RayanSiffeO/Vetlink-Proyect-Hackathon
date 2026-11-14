import { AlertOctagon, AlertTriangle, ArrowRight, ChevronDown, FileText, Info } from 'lucide-react';
import type { AlertEvidence, AlertItem } from '../api/types';
import { severityRank, severityStyle } from '../lib/format';
import { lookupValue } from '../lib/lookup';

interface AlertCardProps {
  alert: AlertItem;
  variant?: 'card' | 'row';
}

interface AlertTone {
  icon: string;
  label: string;
  badge: string;
}

const SEVERITY_ICONS: Record<string, typeof Info> = {
  CRITICAL: AlertOctagon,
  HIGH: AlertTriangle,
  MEDIUM: AlertTriangle,
};

const ALERT_TONES: Record<string, AlertTone> = {
  CRITICAL: {
    icon: 'bg-crit text-white',
    label: 'text-cream/60',
    badge: 'bg-white/10 text-cream/70',
  },
  HIGH: {
    icon: 'bg-warn text-white',
    label: 'text-warn',
    badge: 'bg-warn-soft text-warn',
  },
  MEDIUM: {
    icon: 'bg-infoblue text-white',
    label: 'text-infoblue',
    badge: 'bg-infoblue-soft text-infoblue',
  },
};

const FALLBACK_TONE: AlertTone = {
  icon: 'bg-ink text-white',
  label: 'text-caption',
  badge: 'bg-mist text-caption',
};

function SeverityIcon({ severity }: { severity: string }) {
  const Icon = lookupValue(SEVERITY_ICONS, String(severity ?? '').toUpperCase(), Info);
  return <Icon className="h-[17px] w-[17px]" />;
}

function toneFor(severity: string | null | undefined): AlertTone {
  return lookupValue(ALERT_TONES, String(severity ?? '').toUpperCase(), FALLBACK_TONE);
}

function EvidenceLabel({
  evidence,
  dark,
}: {
  evidence: Array<AlertEvidence | string>;
  dark: boolean;
}) {
  if (evidence.length === 0) return null;
  return (
    <details className="mt-2.5">
      <summary
        className={`inline-flex cursor-pointer items-center gap-1.5 text-[10.5px] font-medium transition duration-200 ease-smooth ${
          dark ? 'text-cream/55 hover:text-cream' : 'text-caption hover:text-ink'
        }`}
      >
        <FileText className="h-3.5 w-3.5" aria-hidden="true" />
        Evidencia · {evidence.length}
      </summary>
      <ul
        className={`mt-2 space-y-1 rounded-xl border p-2.5 ${
          dark ? 'border-white/10 bg-white/5' : 'border-line/70 bg-mist/50'
        }`}
      >
        {evidence.slice(0, 4).map((item, index) => (
          <li
            key={index}
            className={`break-words font-mono text-[10px] leading-snug ${
              dark ? 'text-cream/55' : 'text-caption'
            }`}
          >
            {typeof item === 'string'
              ? item
              : [item.entity, item.id, item.source_ref].filter(Boolean).join(' · ')}
          </li>
        ))}
      </ul>
    </details>
  );
}

function ActionLine({ action, dark }: { action: string; dark: boolean }) {
  return (
    <p className="mt-2.5 flex flex-wrap items-start gap-x-2 gap-y-1">
      <span
        className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[8.5px] font-semibold uppercase tracking-[0.12em] ${
          dark ? 'bg-white/10 text-cream/60' : 'bg-mist text-caption'
        }`}
      >
        Acción
        <ArrowRight className="h-2.5 w-2.5" aria-hidden="true" />
      </span>
      <span
        className={`min-w-0 flex-1 text-[11.5px] leading-[17px] ${
          dark ? 'text-cream/75' : 'text-para'
        }`}
      >
        {action}
      </span>
    </p>
  );
}

export function AlertCard({ alert, variant = 'card' }: AlertCardProps) {
  const severity = String(alert.severity ?? '').toUpperCase();
  const critical = severity === 'CRITICAL';
  const row = variant === 'row';
  const tone = toneFor(severity);
  const style = severityStyle(alert.severity);
  const evidence = alert.evidence ?? [];

  const container = row
    ? 'alert-card group border-b border-line/60 transition duration-200 ease-smooth last:border-b-0 hover:bg-white/45'
    : critical
      ? 'alert-card group overflow-hidden rounded-[20px] border border-white/10 bg-ink text-cream shadow-lift'
      : 'alert-card group overflow-hidden rounded-[20px] border border-line/70 bg-white/80 shadow-soft transition duration-300 ease-smooth hover:bg-white';

  return (
    <details className={container} open={critical || undefined}>
      <summary
        className={`alert-summary flex cursor-pointer list-none items-start gap-3 ${
          row ? 'px-3.5 py-3' : 'p-3.5'
        }`}
      >
        <span
          className={`grid shrink-0 place-items-center rounded-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.25)] ${
            row ? 'h-9 w-9' : 'h-10 w-10'
          } ${tone.icon}`}
          aria-hidden="true"
        >
          <SeverityIcon severity={severity} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[8.5px] font-semibold uppercase tracking-[0.12em] ${tone.badge}`}>
              {style.label}
            </span>
            {alert.category ? (
              <span
                className={`rounded-full px-2 py-0.5 text-[8px] font-medium uppercase tracking-[0.1em] ${
                  critical ? 'bg-white/10 text-cream/60' : 'bg-mist text-caption'
                }`}
              >
                {alert.category}
              </span>
            ) : null}
          </div>
          <p
            className={`mt-0.5 truncate text-[13px] font-medium leading-5 ${
              critical ? 'text-cream' : 'text-ink'
            }`}
          >
            {alert.title}
          </p>
          {alert.action ? (
            <p
              className={`mt-0.5 truncate text-[10.5px] leading-4 ${
                critical ? 'text-cream/55' : 'text-caption'
              }`}
            >
              {alert.action}
            </p>
          ) : null}
        </div>
        <ChevronDown
          className={`alert-chevron mt-1 h-4 w-4 shrink-0 transition duration-200 ease-smooth ${
            critical ? 'text-cream/50' : 'text-caption'
          }`}
          aria-hidden="true"
        />
      </summary>

      {row ? (
        <div className="pb-3.5 pl-[3.6rem] pr-4">
          {alert.message ? (
            <p className="break-words text-[12px] leading-[18px] text-para">{alert.message}</p>
          ) : null}
          {alert.action ? <ActionLine action={alert.action} dark={false} /> : null}
          <EvidenceLabel evidence={evidence} dark={false} />
        </div>
      ) : (
        <div className={`border-t px-4 pb-4 pt-3 ${critical ? 'border-white/10' : 'border-line/60'}`}>
          {alert.message ? (
            <p
              className={`break-words text-[12.5px] leading-[19px] ${
                critical ? 'text-cream/75' : 'text-para'
              }`}
            >
              {alert.message}
            </p>
          ) : null}
          {alert.action ? <ActionLine action={alert.action} dark={critical} /> : null}
          <EvidenceLabel evidence={evidence} dark={critical} />
        </div>
      )}
    </details>
  );
}

export function sortAlerts(alerts: AlertItem[] | null | undefined): AlertItem[] {
  return [...(alerts ?? [])].sort((a, b) => severityRank(a.severity) - severityRank(b.severity));
}

export default AlertCard;
