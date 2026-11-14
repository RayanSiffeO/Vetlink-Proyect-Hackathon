import { ShieldCheck } from 'lucide-react';
import type { ProvenanceSummary } from '../api/types';

interface ProvenanceBadgeProps {
  summary?: ProvenanceSummary | null;
  /** Alternativa: totales ya calculados por la pantalla. */
  entities?: number | null;
  fieldsPopulated?: number | null;
  alerts?: number | null;
  className?: string;
}

function pickNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) {
    return Number(value);
  }
  return null;
}

/** Contador de provenance: "N entidades · N campos · N alertas". */
export function ProvenanceBadge({
  summary,
  entities,
  fieldsPopulated,
  alerts,
  className = '',
}: ProvenanceBadgeProps) {
  const rawAlerts = summary?.alerts;
  const alertCount =
    pickNumber(alerts) ??
    pickNumber(rawAlerts) ??
    (rawAlerts && typeof rawAlerts === 'object'
      ? pickNumber((rawAlerts as Record<string, unknown>).total)
      : null);

  const entityCount = pickNumber(entities) ?? pickNumber(summary?.entities);
  const fieldCount = pickNumber(fieldsPopulated) ?? pickNumber(summary?.fields_populated);

  const parts: string[] = [];
  if (entityCount !== null) parts.push(`${entityCount} entidades`);
  if (fieldCount !== null) parts.push(`${fieldCount} campos`);
  if (alertCount !== null) parts.push(`${alertCount} alertas`);

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border border-secondary/30 bg-secondary/10 px-3 py-1 text-xs font-medium text-secondary ${className}`}
      title="Trazabilidad del registro canónico (provenance)"
    >
      <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
      <span>{parts.length ? parts.join(' · ') : 'Provenance pendiente'}</span>
    </span>
  );
}

export default ProvenanceBadge;
