import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { PatientSummary } from '../../api/types';
import { ageFromBirthDate, formatWeight, initials } from '../../lib/format';
import { identityConfidencePercent } from '../../lib/patients';

function AlertsBadge({ count }: { count: number }) {
  if (count > 0) {
    return (
      <span className="badge badge-error badge-sm gap-1 font-semibold">
        <AlertTriangle className="h-3 w-3" />
        {count} {count === 1 ? 'alerta' : 'alertas'}
      </span>
    );
  }
  return (
    <span className="badge badge-success badge-sm gap-1">
      <CheckCircle2 className="h-3 w-3" />
      Sin alertas
    </span>
  );
}

function PatientIdentity({ patient }: { patient: PatientSummary }) {
  return (
    <div className="flex items-start gap-3">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-sm font-bold text-primary">
        {initials(patient.name)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="truncate text-base font-semibold">{patient.name}</h3>
          <AlertsBadge count={Number(patient.alerts_count ?? 0)} />
        </div>
        <p className="mt-0.5 truncate text-[13px] text-base-content/55">
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
    <div>
      <dt className="vl-label">{label}</dt>
      <dd className={valueClassName}>{value}</dd>
    </div>
  );
}

function PatientMetrics({ patient }: { patient: PatientSummary }) {
  return (
    <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-[12px]">
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
  if (confidence >= 80) return 'bg-success';
  if (confidence >= 50) return 'bg-warning';
  return 'bg-error';
}

function PatientFooter({ patient }: { patient: PatientSummary }) {
  const confidence = identityConfidencePercent(patient);
  return (
    <div className="flex items-center justify-between gap-2 border-t border-base-300/60 pt-2.5">
      <div className="min-w-0 text-[11px] text-base-content/45">
        {confidence !== null ? (
          <span className="inline-flex items-center gap-1.5">
            <span className={`h-1.5 w-1.5 rounded-full ${identityToneClass(confidence)}`} />
            Identidad {confidence}%
          </span>
        ) : (
          <span>Microchip {patient.microchip ?? '—'}</span>
        )}
      </div>
      <Link to={`/patients/${patient.id}`} className="btn btn-primary btn-sm gap-1.5">
        Ver ficha
      </Link>
    </div>
  );
}

export function PatientCard({ patient }: { patient: PatientSummary }) {
  return (
    <article className="vl-card flex flex-col gap-3 p-4 transition-shadow hover:shadow-card">
      <PatientIdentity patient={patient} />
      <PatientMetrics patient={patient} />
      <PatientFooter patient={patient} />
    </article>
  );
}
