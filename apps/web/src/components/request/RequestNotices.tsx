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
    <div className="alert alert-success items-start text-sm">
      <CheckCircle2 className="h-4 w-4 shrink-0" />
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
    <div className="alert alert-warning items-start text-sm">
      <XCircle className="h-4 w-4 shrink-0" />
      <span>
        {status === 'DECLINED'
          ? 'El especialista ha rechazado la solicitud. Puedes buscar otro especialista.'
          : 'La clínica ha cancelado esta solicitud.'}
      </span>
      {specialistRole ? null : (
        <Link to="/specialists" className="btn btn-xs btn-outline ml-auto gap-1">
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
    <p className="flex items-center justify-center gap-1.5 text-center text-[11px] text-base-content/40">
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
    <p className="text-center text-[11px] text-error">
      Urgencia alta · prioriza esta solicitud en tu agenda
    </p>
  );
}
