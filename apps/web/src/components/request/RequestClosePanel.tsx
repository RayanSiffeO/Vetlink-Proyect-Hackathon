import { useState, type ReactNode } from 'react';
import { CheckCircle2, Stethoscope } from 'lucide-react';
import type { CloseRequestPayload, RequestRecord } from '../../api/types';
import { useCloseRequest } from '../../api/hooks';
import { isCloseableStatus } from '../../lib/requests';
import { Spinner } from '../Spinner';

const NOTE_MIN_LENGTH = 3;
const NOTE_MAX_LENGTH = 2000;
const FIELD_MAX_LENGTH = 1000;
const INPUT_CLASS = 'input input-bordered input-sm mt-1 w-full';
const TEXTAREA_CLASS = 'textarea textarea-bordered mt-1 w-full text-sm';

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
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <Stethoscope className="h-4 w-4 text-secondary" />
        Cierre de visita del especialista
      </h2>
      <p className="mt-1 text-[12px] leading-snug text-base-content/55">
        La nota se guarda como encuentro en la ficha clínica de la clínica y la solicitud queda
        completada.
      </p>
    </>
  );
}

function CloseSuccess() {
  return (
    <div className="alert alert-success items-start text-sm" role="status">
      <CheckCircle2 className="h-4 w-4 shrink-0" />
      <span>Visita cerrada · la nota ya está en la ficha de la clínica</span>
    </div>
  );
}

function OpenCloseButton({ onOpen }: { onOpen: () => void }) {
  return (
    <button type="button" className="btn btn-secondary btn-sm mt-3 gap-1.5" onClick={onOpen}>
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
    <p className="mt-2 rounded-lg bg-error/10 px-3 py-2 text-[12px] text-error" role="alert">
      {error.message}
    </p>
  );
}

function CloseActions({ values, mutation, onCancel }: CloseActionsProps) {
  const noteTooShort = values.note.trim().length < NOTE_MIN_LENGTH;
  const save = () => mutation.mutate(closePayload(values));
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <button type="button" className="btn btn-secondary btn-sm gap-1.5" onClick={save}
        disabled={noteTooShort || mutation.isPending}>
        {mutation.isPending ? <Spinner size="xs" /> : <CheckCircle2 className="h-4 w-4" />}
        Guardar nota y cerrar
      </button>
      <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}
        disabled={mutation.isPending}>
        Cancelar
      </button>
      <span className="text-[11px] text-base-content/45">Mínimo {NOTE_MIN_LENGTH} caracteres</span>
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
    <section className="vl-card border-secondary/40 p-5">
      <CloseHeading />
      <CloseForm mutation={mutation} />
    </section>
  );
}
