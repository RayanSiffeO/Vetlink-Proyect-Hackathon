import { severityStyle } from '../lib/format';

function AlertCountChip({ severity, count }: { severity: string; count: number }) {
  const style = severityStyle(severity);
  return (
    <span className={`badge badge-sm ${style.badge}`}>
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
