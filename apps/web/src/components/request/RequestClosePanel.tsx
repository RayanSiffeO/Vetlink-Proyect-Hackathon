import { useState, type ReactNode } from 'react';
import { CheckCircle2, Stethoscope } from 'lucide-react';
import type { CloseRequestPayload, RequestRecord } from '../../api/types';
import { useCloseRequest } from '../../api/hooks';
import { isCloseableStatus } from '../../lib/requests';
import { Spinner } from '../Spinner';

const NOTE_MIN_LENGTH = 3;
const NOTE_MAX_LENGTH = 2000;
const FIELD_MAX_LENGTH = 1000;
const INPUT_CLASS = 'input input-bordered input-sm mt-1 h-9 w-full rounded-btn border-line bg-white/80 text-[12.5px]';
const TEXTAREA_CLASS = 'textarea textarea-bordered mt-1 w-full rounded-xl border-line bg-white/80 text-[12.5px]';

interface CloseFormState {
  note: string;
  diagnosis: string;
  recommendations: string;
  nextVisit: string;
}

interface OptionalFieldsProps {
  values: CloseFormState;
  onChange: (patch: Partial<CloseFormState>) => void;
}

interface CloseActionsProps {
  values: CloseFormState;
  mutation: ReturnType<typeof useCloseRequest>;
  onCancel: () => void;
}

const EMPTY_FORM: CloseFormState = {
  note: '',
  diagnosis: '',
  recommendations: '',
  nextVisit: '',
};

function closePayload(values: CloseFormState): CloseRequestPayload {
  return {
    note: values.note.trim(),
    diagnosis: values.diagnosis.trim() || null,
    recommendations: values.recommendations.trim() || null,
    next_visit: values.nextVisit || null,
  };
}

function CloseField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="vl-label">{label}</span>
      {children}
    </label>
  );
}

function CloseHeading() {
  return (
    <>
      <h2 className="flex items-center gap-2 text-[15px] font-medium leading-6 text-ink">
        <span className="grid h-8 w-8 place-items-center rounded-xl bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-100">
          <Stethoscope className="h-4 w-4" aria-hidden="true" />
        </span>
        Cierre de visita del especialista
      </h2>
      <p className="mt-2 text-[12px] leading-[18px] text-caption">
        La nota se guarda como encuentro en la ficha clínica de la clínica y la solicitud queda
        completada.
      </p>
    </>
  );
}

function CloseSuccess() {
  return (
    <div
      className="flex items-start gap-2.5 rounded-2xl border border-ok/25 bg-ok-soft px-4 py-3 text-[13px] leading-5 text-ok"
      role="status"
    >
      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span>Visita cerrada · la nota ya está en la ficha de la clínica</span>
    </div>
  );
}

function OpenCloseButton({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      className="btn border-0 bg-ink text-cream hover:bg-\[\#3A2E26\] btn-sm mt-3 h-9 gap-1.5 rounded-full px-4 text-[12px] shadow-lift"
      onClick={onOpen}
    >
      <Stethoscope className="h-4 w-4" />
      Cerrar visita
    </button>
  );
}

function CloseNoteField({ value, onChange }: { value: string; onChange: (note: string) => void }) {
  return (
    <CloseField label="Nota de la visita *">
      <textarea className={TEXTAREA_CLASS} rows={4} value={value} maxLength={NOTE_MAX_LENGTH}
        placeholder="Exploración, hallazgos y conclusiones de la visita"
        onChange={(event) => onChange(event.target.value)} />
    </CloseField>
  );
}

function CloseOptionalFields({ values, onChange }: OptionalFieldsProps) {
  return (
    <div className="mt-3 grid gap-3 sm:grid-cols-2">
      <CloseField label="Diagnóstico">
        <input type="text" className={INPUT_CLASS} value={values.diagnosis} maxLength={FIELD_MAX_LENGTH}
          onChange={(event) => onChange({ diagnosis: event.target.value })} />
      </CloseField>
      <CloseField label="Próxima revisión">
        <input type="date" className={INPUT_CLASS} value={values.nextVisit}
          onChange={(event) => onChange({ nextVisit: event.target.value })} />
      </CloseField>
      <CloseField label="Recomendaciones">
        <textarea className={TEXTAREA_CLASS} rows={2} value={values.recommendations} maxLength={FIELD_MAX_LENGTH}
          onChange={(event) => onChange({ recommendations: event.target.value })} />
      </CloseField>
    </div>
  );
}

function CloseError({ error }: { error: Error | null }) {
  if (!error) return null;
  return (
    <p
      className="mt-2 rounded-xl border border-crit/20 bg-crit-soft px-3 py-2 text-[12px] text-crit"
      role="alert"
    >
      {error.message}
    </p>
  );
}

function CloseActions({ values, mutation, onCancel }: CloseActionsProps) {
  const noteTooShort = values.note.trim().length < NOTE_MIN_LENGTH;
  const save = () => mutation.mutate(closePayload(values));
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <button type="button" className="btn border-0 bg-ink text-cream hover:bg-\[\#3A2E26\] btn-sm h-9 gap-1.5 rounded-full px-4 text-[12px] shadow-lift" onClick={save}
        disabled={noteTooShort || mutation.isPending}>
        {mutation.isPending ? <Spinner size="xs" /> : <CheckCircle2 className="h-4 w-4" />}
        Guardar nota y cerrar
      </button>
      <button type="button" className="inline-flex items-center rounded-full px-3 py-1.5 text-[12px] font-medium text-para transition duration-200 ease-smooth hover:bg-white/70 hover:text-ink" onClick={onCancel}
        disabled={mutation.isPending}>
        Cancelar
      </button>
      <span className="text-[11px] leading-4 text-caption">Mínimo {NOTE_MIN_LENGTH} caracteres</span>
    </div>
  );
}

function CloseForm({ mutation }: { mutation: ReturnType<typeof useCloseRequest> }) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState(EMPTY_FORM);
  const patch = (next: Partial<CloseFormState>) => setValues((previous) => ({ ...previous, ...next }));
  if (!open) return <OpenCloseButton onOpen={() => setOpen(true)} />;
  return (
    <div className="mt-3">
      <CloseNoteField value={values.note} onChange={(note) => patch({ note })} />
      <CloseOptionalFields values={values} onChange={patch} />
      <CloseError error={mutation.error} />
      <CloseActions values={values} mutation={mutation} onCancel={() => setOpen(false)} />
    </div>
  );
}

export function RequestClosePanel({ request }: { request: RequestRecord }) {
  const mutation = useCloseRequest(request.id);
  if (mutation.isSuccess) return <CloseSuccess />;
  if (!isCloseableStatus(request.status)) return null;
  return (
    <section className="glass rounded-panel p-5">
      <CloseHeading />
      <CloseForm mutation={mutation} />
    </section>
  );
}
