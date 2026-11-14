import { severityStyle } from '../lib/format';

const ORDER = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'] as const;

const TONES: Record<string, string> = {
  CRITICAL: 'text-crit',
  HIGH: 'text-warn',
  MEDIUM: 'text-infoblue',
  LOW: 'text-[#9a7e68]',
  INFO: 'text-caption',
};

const BARS: Record<string, string> = {
  CRITICAL: 'bg-crit',
  HIGH: 'bg-warn',
  MEDIUM: 'bg-infoblue',
  LOW: 'bg-[#9a7e68]',
  INFO: 'bg-caption/40',
};

function levelCount(counts: Record<string, number>, severity: string): number {
  return Number(counts[severity] ?? 0);
}

export function AlertCountChips({
  counts,
}: {
  counts: Record<string, number> | null | undefined;
}) {
  if (!counts) return null;
  return (
    <div
      className="flex flex-wrap items-stretch gap-1.5"
      role="list"
      aria-label="Escala de gravedad, de mayor a menor: crítica, alta, media, baja e info"
    >
      {ORDER.map((severity) => {
        const label = severityStyle(severity).label;
        const count = levelCount(counts, severity);
        return (
          <div
            key={severity}
            role="listitem"
            title={`${label}: ${count}`}
            className={`flex min-w-[54px] flex-1 flex-col items-center gap-1 rounded-xl border px-2 py-1.5 ${
              count > 0 ? 'border-white/60 bg-white/45' : 'border-line/60 bg-white/25'
            }`}
          >
            <span className={`h-1 w-full rounded-full ${BARS[severity] ?? 'bg-line-strong'}`} />
            <span
              className={`text-[8px] font-semibold uppercase tracking-[0.08em] ${
                TONES[severity] ?? 'text-caption'
              } ${count === 0 ? 'opacity-45' : ''}`}
            >
              {label}
            </span>
            <span
              className={`text-[12px] font-medium leading-none ${
                count > 0 ? TONES[severity] ?? 'text-caption' : 'text-caption/35'
              }`}
            >
              {count}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default AlertCountChips;
