import {
  AlertCircle,
  CalendarClock,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import { URGENCY_OPTIONS, usePatients, useSpecialists } from '../../api/hooks';
import type { ShareLevel, Urgency } from '../../api/types';
import {
  motivoValidationError,
  MOTIVO_MAX_LENGTH,
  type RequestFormPatch,
  type RequestFormState,
} from '../../lib/requests';
import { shareLevelHint, shareLevelLabel } from '../../lib/format';
import type { UrgencyOption } from '../../api/hooks';
import { PatientField, SpecialistField } from './RequestSelects';

const SHARE_LEVELS: ShareLevel[] = ['CLINICAL', 'FULL'];

interface SectionProps {
  form: RequestFormState;
  onUpdate: (patch: RequestFormPatch) => void;
}

export function PatientSpecialistSection({ form, onUpdate }: SectionProps) {
  const patientsQuery = usePatients();
  const specialistsQuery = useSpecialists('', '');
  return (
    <section className="vl-card space-y-4 p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <UserRound className="h-4 w-4 text-secondary" />
        Paciente y especialista
      </h2>
      <PatientField
        value={form.patientId}
        onChange={(patientId) => onUpdate({ patientId })}
        query={patientsQuery}
      />
      <SpecialistField
        value={form.specialistId}
        onChange={(specialistId) => onUpdate({ specialistId })}
        query={specialistsQuery}
      />
    </section>
  );
}

function MotivoField({
  value,
  error,
  onChange,
}: {
  value: string;
  error: string | null;
  onChange: (motivo: string) => void;
}) {
  return (
    <label className="block">
      <span className="vl-label">Motivo / observaciones</span>
      <textarea
        className={`textarea textarea-bordered mt-1 min-h-[104px] w-full text-sm ${
          error ? 'textarea-error' : ''
        }`}
        placeholder="Ej.: cojera intermitente en miembro posterior derecho de 3 semanas de evolución, sin respuesta a analgesia."
        value={value}
        onChange={(event) => onChange(event.target.value)}
        maxLength={MOTIVO_MAX_LENGTH}
      />
      <span className="mt-1 flex items-center justify-between text-[11px] text-base-content/40">
        <span>{error ?? `${value.length}/${MOTIVO_MAX_LENGTH} caracteres`}</span>
        <span>Se comparte con el especialista</span>
      </span>
    </label>
  );
}

function UrgencyOptionCard({
  option,
  selected,
  onSelect,
}: {
  option: UrgencyOption;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <label
      className={`cursor-pointer rounded-xl border px-3 py-2 transition-colors ${
        selected ? 'border-secondary bg-secondary/5' : 'border-base-300 hover:border-secondary/40'
      }`}
    >
      <span className="flex items-center gap-2 text-sm font-medium">
        <input
          type="radio"
          name="urgencia"
          className="radio radio-xs radio-secondary"
          value={option.value}
          checked={selected}
          onChange={onSelect}
        />
        {option.label}
      </span>
      <span className="mt-0.5 block text-[11px] leading-snug text-base-content/45">
        {option.hint}
      </span>
    </label>
  );
}

function UrgencyPicker({
  value,
  onChange,
}: {
  value: Urgency;
  onChange: (urgency: Urgency) => void;
}) {
  return (
    <fieldset>
      <legend className="vl-label">Urgencia</legend>
      <div className="mt-1.5 grid gap-2 sm:grid-cols-3">
        {URGENCY_OPTIONS.map((option) => (
          <UrgencyOptionCard
            key={option.value}
            option={option}
            selected={value === option.value}
            onSelect={() => onChange(option.value)}
          />
        ))}
      </div>
    </fieldset>
  );
}

export function ReasonSection({ form, onUpdate }: SectionProps) {
  return (
    <section className="vl-card space-y-4 p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <AlertCircle className="h-4 w-4 text-secondary" />
        Motivo de la derivación
      </h2>
      <MotivoField
        value={form.motivo}
        error={motivoValidationError(form)}
        onChange={(motivo) => onUpdate({ motivo, touched: true })}
      />
      <UrgencyPicker value={form.urgencia} onChange={(urgencia) => onUpdate({ urgencia })} />
    </section>
  );
}

function ShareLevelOption({
  level,
  selected,
  onSelect,
}: {
  level: ShareLevel;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <label
      className={`cursor-pointer rounded-xl border px-3 py-2 transition-colors ${
        selected ? 'border-primary bg-primary/5' : 'border-base-300 hover:border-primary/40'
      }`}
    >
      <span className="flex items-center gap-2 text-sm font-medium">
        <input
          type="radio"
          name="share_level"
          className="radio radio-xs radio-primary"
          value={level}
          checked={selected}
          onChange={onSelect}
        />
        {shareLevelLabel(level)}
      </span>
      <span className="mt-0.5 block text-[11px] leading-snug text-base-content/45">
        {shareLevelHint(level)}
      </span>
    </label>
  );
}

export function ShareLevelSection({
  value,
  onChange,
}: {
  value: ShareLevel;
  onChange: (value: ShareLevel) => void;
}) {
  return (
    <section className="vl-card space-y-3 p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <ShieldCheck className="h-4 w-4 text-secondary" />
        Nivel de compartición
      </h2>
      <div className="grid gap-2 sm:grid-cols-2">
        {SHARE_LEVELS.map((level) => (
          <ShareLevelOption
            key={level}
            level={level}
            selected={value === level}
            onSelect={() => onChange(level)}
          />
        ))}
      </div>
    </section>
  );
}

function PresetSlotNote({ slot }: { slot: string }) {
  return (
    <p className="rounded-lg bg-secondary/10 px-2.5 py-1.5 text-[11px] text-secondary">
      Franja del especialista: {new Date(slot).toLocaleString('es-ES')}
    </p>
  );
}

export function PreferredSlotsSection({
  presetSlot,
  value,
  onChange,
}: {
  presetSlot: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <section className="vl-card space-y-3 p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <CalendarClock className="h-4 w-4 text-secondary" />
        Franjas preferidas
      </h2>
      {presetSlot ? <PresetSlotNote slot={presetSlot} /> : null}
      <label className="block">
        <span className="vl-label">Fechas o franjas (separadas por comas)</span>
        <input
          type="text"
          className="input input-bordered input-sm mt-1 h-10 w-full"
          placeholder="Ej.: martes tarde, jueves mañana"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      </label>
      <p className="text-[11px] leading-snug text-base-content/45">
        Opcional. El especialista confirmará una franja concreta al aceptar la solicitud.
      </p>
    </section>
  );
}
