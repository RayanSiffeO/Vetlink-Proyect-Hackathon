import { ShieldCheck } from 'lucide-react';
import type { ProvenanceSummary } from '../api/types';

interface ProvenanceBadgeProps {
  summary?: ProvenanceSummary | null;
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

interface ProvenanceSource {
  summary?: ProvenanceSummary | null;
  entities?: number | null;
  fieldsPopulated?: number | null;
  alerts?: number | null;
}

function resolveAlertCount(source: ProvenanceSource): number | null {
  const raw = source.summary?.alerts;
  const nested = raw && typeof raw === 'object' ? pickNumber((raw as Record<string, unknown>).total) : null;
  return pickNumber(source.alerts) ?? pickNumber(raw) ?? nested;
}

function provenanceParts(source: ProvenanceSource): string[] {
  const entityCount = pickNumber(source.entities) ?? pickNumber(source.summary?.entities);
  const fieldCount = pickNumber(source.fieldsPopulated) ?? pickNumber(source.summary?.fields_populated);
  const alertCount = resolveAlertCount(source);
  return [
    entityCount !== null ? `${entityCount} entidades` : null,
    fieldCount !== null ? `${fieldCount} campos` : null,
    alertCount !== null ? `${alertCount} alertas` : null,
  ].filter((part): part is string => part !== null);
}

export function ProvenanceBadge({
  summary,
  entities,
  fieldsPopulated,
  alerts,
  className = '',
}: ProvenanceBadgeProps) {
  const parts = provenanceParts({ summary, entities, fieldsPopulated, alerts });
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
