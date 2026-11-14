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
      className={`inline-flex items-center gap-1.5 rounded-full border border-indigo-100 bg-indigo-50/80 px-2.5 py-1 text-[11px] font-medium leading-4 text-indigo-700 ${className}`}
      title="Trazabilidad del registro canónico (provenance)"
    >
      <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{parts.length ? parts.join(' · ') : 'Provenance pendiente'}</span>
    </span>
  );
}

export default ProvenanceBadge;
