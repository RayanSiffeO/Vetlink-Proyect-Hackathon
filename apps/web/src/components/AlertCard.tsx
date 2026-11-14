import { AlertOctagon, AlertTriangle, ChevronDown, FileText, Info } from 'lucide-react';
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
    label: 'text-cream/60',
    action: 'bg-white/10',
    surface: 'bg-ink',
  },
  HIGH: {
    icon: 'bg-warn text-white',
    label: 'text-warn',
    action: 'bg-warn-soft/70',
    surface: 'border-t-2 border-t-warn/40 bg-white/80 hover:bg-white',
  },
  MEDIUM: {
    icon: 'bg-infoblue text-white',
    label: 'text-infoblue',
    action: 'bg-infoblue-soft/70',
    surface: 'border-t-2 border-t-infoblue/40 bg-white/80 hover:bg-white',
  },
};

const FALLBACK_TONE: AlertTone = {
  icon: 'bg-ink text-white',
  label: 'text-caption',
  action: 'bg-mist',
  surface: 'border-t-2 border-t-line-strong bg-white/80 hover:bg-white',
};

function SeverityIcon({ severity }: { severity: string }) {
  const Icon = lookupValue(SEVERITY_ICONS, String(severity ?? '').toUpperCase(), Info);
  return <Icon className="h-[18px] w-[18px]" />;
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
        className={`inline-flex cursor-pointer items-center gap-1.5 text-[11px] font-medium transition duration-200 ease-smooth ${
          dark ? 'text-cream/55 hover:text-cream' : 'text-caption hover:text-ink'
        }`}
      >
        <FileText className="h-3.5 w-3.5" aria-hidden="true" />
        Evidencia · {evidence.length}
      </summary>
      <ul
        className={`mt-2 space-y-1 rounded-xl border p-2.5 ${
          dark ? 'border-white/10 bg-white/5' : 'border-line/70 bg-mist/60'
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

export function AlertCard({ alert }: AlertCardProps) {
  const severity = String(alert.severity ?? '').toUpperCase();
  const critical = severity === 'CRITICAL';
  const tone = toneFor(severity);
  const style = severityStyle(alert.severity);
  const evidence = alert.evidence ?? [];
  const action = alert.action;

  return (
    <details
      className={`alert-card group overflow-hidden rounded-[20px] border shadow-soft transition duration-300 ease-smooth ${
        critical
          ? 'border-white/10 bg-ink text-cream shadow-lift'
          : `border-line/70 text-ink hover:border-line-strong ${tone.surface}`
      }`}
      open={critical || undefined}
    >
      <summary className="alert-summary flex cursor-pointer list-none items-center gap-3 p-3.5">
        <span
          className={`grid h-10 w-10 shrink-0 place-items-center rounded-[14px] shadow-[inset_0_1px_0_rgba(255,255,255,0.25)] ${tone.icon}`}
          aria-hidden="true"
        >
          <SeverityIcon severity={severity} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`text-[9px] font-semibold uppercase tracking-[0.14em] ${tone.label}`}>
              {style.label}
            </span>
            {alert.category ? (
              <span
                className={`rounded-full px-2 py-0.5 text-[8.5px] font-medium uppercase tracking-[0.1em] ${
                  critical ? 'bg-white/10 text-cream/60' : 'bg-mist text-caption'
                }`}
              >
                {alert.category}
              </span>
            ) : null}
          </div>
          <p
            className={`mt-0.5 truncate text-[13.5px] font-medium leading-5 ${
              critical ? 'text-cream' : 'text-ink'
            }`}
          >
            {alert.title}
          </p>
          {action ? (
            <p
              className={`mt-0.5 truncate text-[11px] leading-4 ${
                critical ? 'text-cream/55' : 'text-caption'
              }`}
            >
              {action}
            </p>
          ) : null}
        </div>
        <ChevronDown
          className={`alert-chevron h-4 w-4 shrink-0 transition duration-200 ease-smooth ${
            critical ? 'text-cream/50' : 'text-caption'
          }`}
          aria-hidden="true"
        />
      </summary>

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
        {action ? (
          <div
            className={`mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-1 rounded-xl px-3 py-2 ${tone.action}`}
          >
            <span
              className={`text-[9px] font-semibold uppercase tracking-[0.12em] ${
                critical ? 'text-cream/55' : tone.label
              }`}
            >
              Acción
            </span>
            <span
              className={`min-w-0 flex-1 text-[11.5px] leading-[17px] ${
                critical ? 'text-cream/80' : 'text-para'
              }`}
            >
              {action}
            </span>
          </div>
        ) : null}
        <EvidenceLabel evidence={evidence} dark={critical} />
      </div>
    </details>
  );
}

export function sortAlerts(alerts: AlertItem[] | null | undefined): AlertItem[] {
  return [...(alerts ?? [])].sort((a, b) => severityRank(a.severity) - severityRank(b.severity));
}

export default AlertCard;
