import { severityStyle } from '../lib/format';
import { lookupValue } from '../lib/lookup';

const CHIP_TONES: Record<string, string> = {
  CRITICAL: 'border-crit/20 bg-crit-soft text-crit',
  HIGH: 'border-warn/20 bg-warn-soft text-warn',
  MEDIUM: 'border-infoblue/20 bg-infoblue-soft text-infoblue',
  LOW: 'border-line-strong bg-white/70 text-caption',
  INFO: 'border-indigo-100 bg-indigo-50 text-indigo-700',
};

const FALLBACK_CHIP_TONE = 'border-line-strong bg-white/70 text-caption';

function AlertCountChip({ severity, count }: { severity: string; count: number }) {
  const style = severityStyle(severity);
  const tone = lookupValue(CHIP_TONES, String(severity ?? '').toUpperCase(), FALLBACK_CHIP_TONE);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium leading-4 ${tone}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
      {count} {style.label.toLowerCase()}
    </span>
  );
}

export function AlertCountChips({ counts }: { counts: Record<string, number> | null | undefined }) {
  if (!counts) return null;
  const entries = Object.entries(counts).filter(([, value]) => Number(value) > 0);
  if (entries.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {entries.map(([severity, count]) => (
        <AlertCountChip key={severity} severity={severity} count={count} />
      ))}
    </div>
  );
}
