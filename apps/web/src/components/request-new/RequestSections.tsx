import {
  AlertCircle,
  CalendarClock,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
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

function SectionHeading({ icon, title }: { icon: LucideIcon; title: string }) {
  const Icon = icon;
  return (
    <h2 className="flex items-center gap-2.5 text-[15px] font-medium leading-6 text-ink">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-100">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      {title}
    </h2>
  );
}

export function PatientSpecialistSection({ form, onUpdate }: SectionProps) {
  const patientsQuery = usePatients();
  const specialistsQuery = useSpecialists('', '');
  return (
    <section className="glass space-y-4 rounded-panel p-5">
      <SectionHeading icon={UserRound} title="Paciente y especialista" />
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
        className={`textarea textarea-bordered mt-1 min-h-[104px] w-full rounded-xl border-line bg-white/80 text-[12.5px] leading-[19px] ${
          error ? 'textarea-error' : ''
        }`}
        placeholder="Ej.: cojera intermitente en miembro posterior derecho de 3 semanas de evolución, sin respuesta a analgesia."
        value={value}
        onChange={(event) => onChange(event.target.value)}
        maxLength={MOTIVO_MAX_LENGTH}
      />
      <span className="mt-1 flex items-center justify-between gap-2 text-[11px] leading-4 text-caption">
        <span className={error ? 'text-crit' : ''}>{error ?? `${value.length}/${MOTIVO_MAX_LENGTH} caracteres`}</span>
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
      className={`cursor-pointer rounded-xl border px-3 py-2.5 transition duration-200 ease-smooth hover:-translate-y-px ${
        selected
          ? 'border-indigo bg-indigo-50/80 ring-1 ring-inset ring-indigo-100'
          : 'border-line bg-white/55 hover:border-indigo-300'
      }`}
    >
      <span className="flex items-center gap-2 text-[12.5px] font-medium leading-4 text-ink">
        <input
          type="radio"
          name="urgencia"
          className="radio radio-xs radio-primary"
          value={option.value}
          checked={selected}
          onChange={onSelect}
        />
        {option.label}
      </span>
      <span className="mt-1 block text-[11px] leading-[16px] text-caption">{option.hint}</span>
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
    <section className="glass space-y-4 rounded-panel p-5">
      <SectionHeading icon={AlertCircle} title="Motivo de la derivación" />
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
      className={`cursor-pointer rounded-xl border px-3 py-2.5 transition duration-200 ease-smooth hover:-translate-y-px ${
        selected
          ? 'border-indigo bg-indigo-50/80 ring-1 ring-inset ring-indigo-100'
          : 'border-line bg-white/55 hover:border-indigo-300'
      }`}
    >
      <span className="flex items-center gap-2 text-[12.5px] font-medium leading-4 text-ink">
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
      <span className="mt-1 block text-[11px] leading-[16px] text-caption">
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
    <section className="glass space-y-3 rounded-panel p-5">
      <SectionHeading icon={ShieldCheck} title="Nivel de compartición" />
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
    <p className="rounded-xl border border-indigo-100 bg-indigo-50 px-2.5 py-1.5 text-[11px] leading-4 text-indigo-700">
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
    <section className="glass space-y-3 rounded-panel p-5">
      <SectionHeading icon={CalendarClock} title="Franjas preferidas" />
      {presetSlot ? <PresetSlotNote slot={presetSlot} /> : null}
      <label className="block">
        <span className="vl-label">Fechas o franjas (separadas por comas)</span>
        <input
          type="text"
          className="input input-bordered input-sm mt-1 h-10 w-full rounded-btn border-line bg-white/80 text-[12.5px]"
          placeholder="Ej.: martes tarde, jueves mañana"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      </label>
      <p className="text-[11px] leading-[16px] text-caption">
        Opcional. El especialista confirmará una franja concreta al aceptar la solicitud.
      </p>
    </section>
  );
}
