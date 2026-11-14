import { AlertCircle, Send } from 'lucide-react';
import { URGENCY_OPTIONS, useCreateRequest, usePatients, useSpecialists } from '../../api/hooks';
import type { RequestFormState } from '../../lib/requests';
import { Spinner } from '../Spinner';

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-base-content/50">{label}</dt>
      <dd className="truncate font-medium">{value}</dd>
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
    <dl className="space-y-1.5 text-[12px]">
      <SummaryRow label="Paciente" value={patient?.name ?? '—'} />
      <SummaryRow label="Especialista" value={specialist?.name ?? '—'} />
      <SummaryRow label="Urgencia" value={urgency} />
      <SummaryRow label="Compartición" value={form.shareLevel} />
    </dl>
  );
}

function SubmitButton({ pending, disabled }: { pending: boolean; disabled: boolean }) {
  return (
    <button type="submit" className="btn btn-primary mt-2 w-full gap-1.5" disabled={pending || disabled}>
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
    <section className="vl-card space-y-2 p-5">
      <h2 className="text-sm font-semibold">Resumen</h2>
      <SummaryList form={form} />
      {mutation.isError ? (
        <div className="alert alert-error mt-2 items-start p-2 text-[12px]" role="alert">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{mutation.error.message}</span>
        </div>
      ) : null}
      <SubmitButton pending={mutation.isPending} disabled={!canSubmit} />
      {canSubmit ? null : (
        <p className="text-center text-[11px] text-base-content/40">
          Selecciona paciente y especialista y escribe el motivo.
        </p>
      )}
    </section>
  );
}
