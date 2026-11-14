import { severityStyle } from '../lib/format';
import { lookupValue } from '../lib/lookup';

const CHIP_TONES: Record<string, string> = {
  CRITICAL: 'text-crit',
  HIGH: 'text-warn',
  MEDIUM: 'text-infoblue',
  LOW: 'text-caption',
  INFO: 'text-caption',
};

const FALLBACK_CHIP_TONE = 'text-caption';

function AlertCountChip({ severity, count }: { severity: string; count: number }) {
  const style = severityStyle(severity);
  const tone = lookupValue(CHIP_TONES, String(severity ?? '').toUpperCase(), FALLBACK_CHIP_TONE);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-white/60 bg-white/45 px-2.5 py-1 text-[11px] font-medium leading-4 ${tone}`}
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
