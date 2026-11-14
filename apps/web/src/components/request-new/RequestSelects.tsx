import { usePatients, useSpecialists } from '../../api/hooks';
import { ageFromBirthDate, formatPrice } from '../../lib/format';
import { Stethoscope } from 'lucide-react';

interface PatientFieldProps {
  value: string;
  onChange: (patientId: string) => void;
  query: ReturnType<typeof usePatients>;
}

interface SpecialistFieldProps {
  value: string;
  onChange: (specialistId: string) => void;
  query: ReturnType<typeof useSpecialists>;
}

const SELECT_CLASS =
  'select select-bordered select-sm mt-1 h-10 w-full rounded-btn border-line bg-white/80 text-[12.5px]';

export function PatientField({ value, onChange, query }: PatientFieldProps) {
  const patients = query.data?.patients ?? [];
  const selected = patients.find((patient) => patient.id === value) ?? null;
  return (
    <label className="block">
      <span className="vl-label">Paciente</span>
      <select
        className={SELECT_CLASS}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required
      >
        <option value="">Selecciona un paciente…</option>
        {patients.map((patient) => (
          <option key={patient.id} value={patient.id}>
            {patient.name} · {patient.species ?? '—'} · {ageFromBirthDate(patient.birth_date)}
          </option>
        ))}
      </select>
      {selected ? (
        <span className="mt-1 block text-[11px] leading-4 text-caption">
          {[selected.breed, selected.owner_display].filter(Boolean).join(' · ')}
        </span>
      ) : null}
    </label>
  );
}

function SpecialistFieldHint({
  error,
  specialist,
}: {
  error?: Error;
  specialist: { specialty: string; zone: string; price_from?: number | null } | null;
}) {
  return (
    <>
      {error ? (
        <span className="mt-1 block text-[11px] leading-4 text-crit">
          No se pudo cargar el marketplace: {error.message}
        </span>
      ) : null}
      {specialist ? (
        <span className="mt-1 flex items-center gap-1.5 text-[11px] leading-4 text-caption">
          <Stethoscope className="h-3 w-3" aria-hidden="true" />
          {specialist.specialty} · {specialist.zone} · desde {formatPrice(specialist.price_from)}
        </span>
      ) : null}
    </>
  );
}

export function SpecialistField({ value, onChange, query }: SpecialistFieldProps) {
  const specialists = query.data?.specialists ?? [];
  const selected = specialists.find((specialist) => specialist.id === value) ?? null;
  return (
    <label className="block">
      <span className="vl-label">Especialista</span>
      <select
        className={SELECT_CLASS}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required
        disabled={query.isLoading}
      >
        <option value="">
          {query.isLoading ? 'Cargando especialistas…' : 'Selecciona especialista…'}
        </option>
        {specialists.map((specialist) => (
          <option key={specialist.id} value={specialist.id}>
            {specialist.name} · {specialist.specialty} · {specialist.zone}
          </option>
        ))}
      </select>
      <SpecialistFieldHint error={query.error ?? undefined} specialist={selected} />
    </label>
  );
}
