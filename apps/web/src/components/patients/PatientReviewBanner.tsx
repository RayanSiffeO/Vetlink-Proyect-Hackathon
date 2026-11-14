import { AlertTriangle, CheckCircle2, ShieldCheck } from 'lucide-react';
import { useIsSpecialist, useReviewRecord } from '../../api/hooks';
import type { ReviewSummary } from '../../api/types';
import { formatDateTime } from '../../lib/format';
import { Spinner } from '../Spinner';

function pendingCount(review: ReviewSummary): number {
  return Number(review.pending_review ?? 0);
}

function fieldNames(review: ReviewSummary): string[] {
  const fields = review.critical_fields ?? [];
  return fields
    .filter((item) => typeof item === 'string' || item.review_required !== false)
    .map((item) => (typeof item === 'string' ? item : String(item.field ?? '')))
    .filter(Boolean);
}

function pendingLabel(count: number): string {
  return count === 1 ? '1 campo pendiente de revisión' : `${count} campos pendientes de revisión`;
}

function ReviewedBanner({ review }: { review: ReviewSummary }) {
  const stamp = review.reviewed_at ? ` · ${formatDateTime(review.reviewed_at)}` : '';
  return (
    <div className="alert alert-success flex items-start gap-3 text-left" role="status">
      <CheckCircle2 className="h-5 w-5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">Revisado por {review.reviewed_by}</p>
        <p className="text-[12px] opacity-80">
          Campos críticos confirmados{stamp}. La revisión queda registrada en la auditoría.
        </p>
      </div>
    </div>
  );
}

function PendingMessage({ review }: { review: ReviewSummary }) {
  const fields = fieldNames(review);
  return (
    <>
      <p className="text-sm font-semibold">{pendingLabel(pendingCount(review))}</p>
      <p className="mt-0.5 text-[12px] text-base-content/70">
        {fields.length > 0
          ? `Campos dudosos: ${fields.join(' · ')}.`
          : 'La importación detectó datos con confianza baja.'}{' '}
        Confirma la revisión antes de compartir la ficha: el briefing no se publica con campos
        críticos pendientes.
      </p>
    </>
  );
}

function ReviewFeedback({ mutation }: { mutation: ReturnType<typeof useReviewRecord> }) {
  if (mutation.isError) {
    return (
      <p className="mt-1 text-[12px] font-semibold text-error">
        No se pudo confirmar la revisión: {mutation.error.message}
      </p>
    );
  }
  if (mutation.isSuccess) {
    return (
      <p className="mt-1 text-[12px] font-semibold text-success">
        Revisión registrada y auditada correctamente.
      </p>
    );
  }
  return null;
}

function ConfirmButton({ mutation, fields }: { mutation: ReturnType<typeof useReviewRecord>; fields: string[] }) {
  return (
    <button
      type="button"
      className="btn btn-warning btn-sm w-full gap-1.5 sm:w-auto"
      disabled={mutation.isPending}
      onClick={() => mutation.mutate({ reviewed_fields: fields })}
    >
      {mutation.isPending ? <Spinner size="xs" /> : <ShieldCheck className="h-4 w-4" />}
      {mutation.isPending ? 'Confirmando…' : 'Confirmar revisión'}
    </button>
  );
}

function ClinicAction({ mutation, fields }: { mutation: ReturnType<typeof useReviewRecord>; fields: string[] }) {
  return (
    <div className="w-full shrink-0 sm:w-auto">
      <ConfirmButton mutation={mutation} fields={fields} />
    </div>
  );
}

function SpecialistNote() {
  return (
    <p className="mt-1 w-full text-[11px] text-base-content/55 sm:w-auto">
      Solo la clínica puede confirmar la revisión de esta ficha.
    </p>
  );
}

export function PatientReviewBanner({
  patientId,
  review,
}: {
  patientId: string;
  review?: ReviewSummary | null;
}) {
  const specialist = useIsSpecialist();
  const mutation = useReviewRecord(patientId);
  if (!review) return null;
  if (review.reviewed_by) return <ReviewedBanner review={review} />;
  if (pendingCount(review) <= 0) return null;
  const fields = fieldNames(review);
  return (
    <div className="alert alert-warning flex flex-wrap items-start gap-3 text-left" role="status">
      <AlertTriangle className="h-5 w-5 shrink-0" />
      <div className="min-w-0 flex-1">
        <PendingMessage review={review} />
        {specialist ? null : <ReviewFeedback mutation={mutation} />}
      </div>
      {specialist ? <SpecialistNote /> : <ClinicAction mutation={mutation} fields={fields} />}
    </div>
  );
}

export default PatientReviewBanner;
