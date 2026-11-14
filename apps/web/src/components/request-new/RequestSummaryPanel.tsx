import { AlertCircle, Send } from 'lucide-react';
import { URGENCY_OPTIONS, useCreateRequest, usePatients, useSpecialists } from '../../api/hooks';
import type { RequestFormState } from '../../lib/requests';
import { Spinner } from '../Spinner';

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-caption">{label}</dt>
      <dd className="truncate text-[12px] font-medium text-ink">{value}</dd>
    </div>
  );
}

function SummaryList({ form }: { form: RequestFormState }) {
  const patients = usePatients().data?.patients ?? [];
  const specialists = useSpecialists('', '').data?.specialists ?? [];
  const patient = patients.find((item) => item.id === form.patientId) ?? null;
  const specialist = specialists.find((item) => item.id === form.specialistId) ?? null;
  const urgency =
    URGENCY_OPTIONS.find((option) => option.value === form.urgencia)?.label ?? form.urgencia;
  return (
    <dl className="mt-2 space-y-1.5 rounded-2xl border border-line bg-white/55 px-3 py-2.5 text-[12px] leading-[18px]">
      <SummaryRow label="Paciente" value={patient?.name ?? '—'} />
      <SummaryRow label="Especialista" value={specialist?.name ?? '—'} />
      <SummaryRow label="Urgencia" value={urgency} />
      <SummaryRow label="Compartición" value={form.shareLevel} />
    </dl>
  );
}

function SubmitButton({ pending, disabled }: { pending: boolean; disabled: boolean }) {
  return (
    <button
      type="submit"
      className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-indigo px-4 py-2.5 text-[12.5px] font-medium text-white shadow-lift transition duration-200 ease-smooth hover:-translate-y-0.5 hover:bg-indigo-700 disabled:pointer-events-none disabled:opacity-50"
      disabled={pending || disabled}
    >
      {pending ? <Spinner size="sm" /> : <Send className="h-4 w-4" />}
      Enviar solicitud
    </button>
  );
}

export function RequestSummaryPanel({
  form,
  canSubmit,
  mutation,
}: {
  form: RequestFormState;
  canSubmit: boolean;
  mutation: ReturnType<typeof useCreateRequest>;
}) {
  return (
    <section className="glass-strong space-y-2 rounded-panel p-5">
      <h2 className="text-[15px] font-medium leading-6 text-ink">Resumen</h2>
      <SummaryList form={form} />
      {mutation.isError ? (
        <div
          className="mt-2 flex items-start gap-2 rounded-xl border border-crit/20 bg-crit-soft p-2.5 text-left text-[12px] leading-[18px] text-crit"
          role="alert"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{mutation.error.message}</span>
        </div>
      ) : null}
      <SubmitButton pending={mutation.isPending} disabled={!canSubmit} />
      {canSubmit ? null : (
        <p className="text-center text-[11px] leading-4 text-caption">
          Selecciona paciente y especialista y escribe el motivo.
        </p>
      )}
    </section>
  );
}
