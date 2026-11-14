import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  CalendarClock,
  CalendarDays,
  Clock3,
  Send,
  Stethoscope,
  UserRound,
} from 'lucide-react';
import { EmptyState, ErrorState } from '../components/EmptyState';
import { LoadingCards } from '../components/Loading';
import { useAppointments, useMe } from '../api/hooks';
import type { Appointment } from '../api/types';
import {
  formatDateTime,
  formatWeekday,
  isSpecialist,
  relativeTime,
  requestStatusStyle,
} from '../lib/format';

function AppointmentCard({ appointment }: { appointment: Appointment }) {
  const status = requestStatusStyle(appointment.status);
  const date = appointment.when_iso;
  const patient =
    appointment.patient_name ?? (appointment.patient_display as string | undefined) ?? null;
  const specialist =
    appointment.specialist_name ?? (appointment.specialist_display as string | undefined) ?? null;
  const isUpcoming = date ? new Date(date).getTime() >= Date.now() : false;

  return (
    <article className="vl-card flex flex-col gap-2 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-secondary">
            {formatWeekday(date)}
          </p>
          <h3 className="truncate text-base font-semibold">{formatDateTime(date)}</h3>
        </div>
        <span className={`badge badge-sm ${status.badge}`}>{status.label}</span>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-base-content/60">
        {patient ? (
          <span className="inline-flex items-center gap-1">
            <UserRound className="h-3.5 w-3.5" />
            {patient}
          </span>
        ) : null}
        {specialist ? (
          <span className="inline-flex items-center gap-1">
            <Stethoscope className="h-3.5 w-3.5" />
            {specialist}
            {appointment.specialty ? ` · ${appointment.specialty}` : ''}
          </span>
        ) : null}
        {!patient && !specialist ? (
          <span className="inline-flex items-center gap-1">
            <Clock3 className="h-3.5 w-3.5" />
            Cita {String(appointment.id).slice(0, 8)}
          </span>
        ) : null}
      </div>

      {appointment.motivo ? (
        <p className="line-clamp-2 text-[12px] leading-snug text-base-content/55">
          {appointment.motivo}
        </p>
      ) : null}

      <div className="mt-auto flex items-center justify-between gap-2 border-t border-base-300/60 pt-2">
        <span className="text-[11px] text-base-content/45">
          {isUpcoming ? `Próxima · ${relativeTime(date)}` : `Pasada · ${relativeTime(date)}`}
        </span>
        {appointment.request_id ? (
          <Link
            to={`/requests/${appointment.request_id}`}
            className="btn btn-ghost btn-xs gap-1"
          >
            <Send className="h-3.5 w-3.5" />
            Ver solicitud
          </Link>
        ) : null}
      </div>
    </article>
  );
}

export function Calendar() {
  const { data: user } = useMe();
  const { data, isLoading, isError, error, refetch } = useAppointments();
  const specialistRole = isSpecialist(user);

  const appointments = [...(data?.appointments ?? [])].sort((a, b) =>
    String(a.when_iso ?? '').localeCompare(String(b.when_iso ?? '')),
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="vl-section-title">Agenda</p>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold tracking-tight">
            <CalendarDays className="h-6 w-6 text-secondary" aria-hidden="true" />
            Calendario
          </h1>
          <p className="mt-1 text-sm text-base-content/55">
            {specialistRole
              ? 'Tus visitas aceptadas, en orden cronológico.'
              : 'Visitas de la clínica confirmadas con especialistas.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/requests" className="btn btn-outline btn-sm gap-1.5">
            <Send className="h-4 w-4" />
            Solicitudes
          </Link>
          <Link to={specialistRole ? '/specialists' : '/patients'} className="btn btn-ghost btn-sm gap-1.5">
            <ArrowLeft className="h-4 w-4" />
            Volver
          </Link>
        </div>
      </header>

      {isLoading ? (
        <LoadingCards count={3} />
      ) : isError ? (
        <ErrorState
          error={error}
          title="No se pudo cargar el calendario"
          onRetry={() => refetch()}
        />
      ) : appointments.length === 0 ? (
        <EmptyState
          title="Sin citas en la agenda"
          description="Cuando una solicitud se acepte con una franja concreta, la cita aparecerá aquí."
          icon={<CalendarClock className="h-6 w-6" />}
          action={
            <Link to="/requests" className="btn btn-primary btn-sm">
              Ver solicitudes
            </Link>
          }
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {appointments.map((appointment) => (
              <AppointmentCard key={appointment.id} appointment={appointment} />
            ))}
          </div>
          <p className="text-center text-[11px] text-base-content/35">
            {appointments.length} {appointments.length === 1 ? 'cita' : 'citas'} · hora local
            Europe/Madrid
          </p>
        </>
      )}
    </div>
  );
}

export default Calendar;
