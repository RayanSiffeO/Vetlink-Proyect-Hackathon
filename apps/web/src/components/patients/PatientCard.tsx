import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight, CheckCircle2 } from 'lucide-react';
import type { PatientSummary } from '../../api/types';
import { ageFromBirthDate, formatWeight, initials } from '../../lib/format';
import { identityConfidencePercent } from '../../lib/patients';

function AlertsBadge({ count }: { count: number }) {
  if (count > 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-crit/20 bg-crit-soft px-2 py-0.5 text-[10.5px] font-medium leading-4 text-crit">
        <AlertTriangle className="h-3 w-3" aria-hidden="true" />
        {count} {count === 1 ? 'alerta' : 'alertas'}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-ok/20 bg-ok-soft px-2 py-0.5 text-[10.5px] font-medium leading-4 text-ok">
      <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
      Sin alertas
    </span>
  );
}

function PatientIdentity({ patient }: { patient: PatientSummary }) {
  return (
    <div className="flex items-start gap-3">
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[linear-gradient(135deg,#5C59F3_0%,#2F33A8_100%)] text-[15px] font-medium tracking-tight text-white shadow-lift">
        {initials(patient.name)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="truncate text-[16.5px] font-medium leading-6 tracking-[-0.01em] text-ink">
            {patient.name}
          </h3>
          <AlertsBadge count={Number(patient.alerts_count ?? 0)} />
        </div>
        <p className="mt-0.5 truncate text-[12.5px] leading-5 text-caption">
          {[patient.species, patient.breed].filter(Boolean).join(' · ') || 'Especie sin definir'}
        </p>
      </div>
    </div>
  );
}

function PatientMetric({
  label,
  value,
  valueClassName = 'vl-value',
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="vl-metric min-w-0">
      <dt className="vl-label">{label}</dt>
      <dd className={`mt-0.5 ${valueClassName}`}>{value}</dd>
    </div>
  );
}

function PatientMetrics({ patient }: { patient: PatientSummary }) {
  return (
    <dl className="grid grid-cols-2 gap-2">
      <PatientMetric label="Edad" value={ageFromBirthDate(patient.birth_date)} />
      <PatientMetric label="Peso" value={formatWeight(patient.weight_current_kg)} />
      <PatientMetric label="BCS" value={String(patient.bcs ?? '—')} />
      <PatientMetric
        label="Tutor"
        value={String(patient.owner_display ?? '—')}
        valueClassName="truncate vl-value"
      />
    </dl>
  );
}

function identityToneClass(confidence: number): string {
  if (confidence >= 80) return 'bg-ok';
  if (confidence >= 50) return 'bg-warn';
  return 'bg-crit';
}

function PatientFooter({ patient }: { patient: PatientSummary }) {
  const confidence = identityConfidencePercent(patient);
  return (
    <div className="mt-auto flex items-center justify-between gap-2 border-t border-line/80 pt-3">
      <div className="min-w-0 text-[11px] text-caption">
        {confidence !== null ? (
          <span className="inline-flex items-center gap-1.5">
            <span className={`h-1.5 w-1.5 rounded-full ${identityToneClass(confidence)}`} />
            Identidad {confidence}%
          </span>
        ) : (
          <span>Microchip {patient.microchip ?? '—'}</span>
        )}
      </div>
      <Link
        to={`/patients/${patient.id}`}
        className="group/cta inline-flex items-center gap-1.5 rounded-full bg-indigo px-3.5 py-1.5 text-[12px] font-medium text-white shadow-lift transition duration-200 ease-smooth hover:-translate-y-0.5 hover:bg-indigo-700"
      >
        Ver ficha
        <ArrowRight className="h-3.5 w-3.5 transition duration-200 ease-smooth group-hover/cta:translate-x-0.5" />
      </Link>
    </div>
  );
}

export function PatientCard({ patient }: { patient: PatientSummary }) {
  return (
    <article className="group flex flex-col gap-3.5 rounded-card border border-line bg-white/70 p-4 shadow-soft transition duration-300 ease-smooth hover:-translate-y-0.5 hover:border-indigo-100 hover:bg-white/90 hover:shadow-card">
      <PatientIdentity patient={patient} />
      <PatientMetrics patient={patient} />
      <PatientFooter patient={patient} />
    </article>
  );
}
