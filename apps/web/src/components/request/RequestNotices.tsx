import { Link } from 'react-router-dom';
import { CheckCircle2, Send, Stethoscope, XCircle } from 'lucide-react';
import { useIsSpecialist } from '../../api/hooks';
import type { RequestRecord } from '../../api/types';
import { isUnlockedStatus } from '../../lib/format';
import { isHighUrgency } from '../../lib/requests';

export function UnlockedNotice({ status }: { status: string }) {
  const specialistRole = useIsSpecialist();
  if (!specialistRole || !isUnlockedStatus(status)) return null;
  return (
    <div className="flex items-start gap-2.5 rounded-2xl border border-ok/25 bg-ok-soft px-4 py-3 text-[13px] leading-5 text-ok">
      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span>
        Historia desbloqueada. El briefing pre-visita ya está disponible en la pestaña «Briefing».
      </span>
    </div>
  );
}

export function ClosedNotice({ status }: { status: string }) {
  const specialistRole = useIsSpecialist();
  if (status !== 'DECLINED' && status !== 'CANCELLED') return null;
  return (
    <div className="flex flex-wrap items-start gap-3 rounded-2xl border border-warn/25 bg-warn-soft px-4 py-3 text-[13px] leading-5 text-para">
      <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-warn" aria-hidden="true" />
      <span className="min-w-0 flex-1">
        {status === 'DECLINED'
          ? 'El especialista ha rechazado la solicitud. Puedes buscar otro especialista.'
          : 'La clínica ha cancelado esta solicitud.'}
      </span>
      {specialistRole ? null : (
        <Link
          to="/specialists"
          className="inline-flex items-center gap-1 rounded-full border border-warn/25 bg-white/70 px-2.5 py-1 text-[11px] font-medium text-warn transition duration-200 ease-smooth hover:-translate-y-px hover:bg-white"
        >
          <Stethoscope className="h-3.5 w-3.5" />
          Buscar otro
        </Link>
      )}
    </div>
  );
}

export function ConfirmedFooter({ status }: { status: string }) {
  const specialistRole = useIsSpecialist();
  if (specialistRole || !isUnlockedStatus(status)) return null;
  return (
    <p className="flex items-center justify-center gap-1.5 text-center text-[11px] text-caption">
      <Send className="inline h-3 w-3" />
      Visita confirmada: revisa la agenda en el calendario.
    </p>
  );
}

export function UrgentNote({ request }: { request: RequestRecord }) {
  const specialistRole = useIsSpecialist();
  const status = String(request.status ?? '').toUpperCase();
  if (!specialistRole || !isHighUrgency(request.urgencia) || status !== 'REQUESTED') return null;
  return (
    <p className="text-center text-[11px] font-medium text-crit">
      Urgencia alta · prioriza esta solicitud en tu agenda
    </p>
  );
}
