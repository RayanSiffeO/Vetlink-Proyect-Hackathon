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
import { CardGrid } from '../components/CardGrid';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/badges';
import { useAppointments, useIsSpecialist } from '../api/hooks';
import type { Appointment } from '../api/types';
import { formatDateTime, formatWeekday, relativeTime } from '../lib/format';
import { sortAppointments } from '../lib/appointments';

function AppointmentSchedule({ appointment }: { appointment: Appointment }) {
  const date = appointment.when_iso;
  return (
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-secondary">
          {formatWeekday(date)}
        </p>
        <h3 className="truncate text-base font-semibold">{formatDateTime(date)}</h3>
      </div>
      <StatusBadge status={appointment.status} variant="plain" />
    </div>
  );
}

function AppointmentPeople({ appointment }: { appointment: Appointment }) {
  const patient =
    appointment.patient_name ?? (appointment.patient_display as string | undefined) ?? null;
  const specialist =
    appointment.specialist_name ?? (appointment.specialist_display as string | undefined) ?? null;
  const specialtySuffix = appointment.specialty ? ` · ${appointment.specialty}` : '';
  return (
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
          {specialtySuffix}
        </span>
      ) : null}
      {!patient && !specialist ? (
        <span className="inline-flex items-center gap-1">
          <Clock3 className="h-3.5 w-3.5" />
          Cita {String(appointment.id).slice(0, 8)}
        </span>
      ) : null}
    </div>
  );
}

function AppointmentMotivo({ motivo }: { motivo?: string | null }) {
  if (!motivo) return null;
  return <p className="line-clamp-2 text-[12px] leading-snug text-base-content/55">{motivo}</p>;
}

function AppointmentFooter({ appointment }: { appointment: Appointment }) {
  const date = appointment.when_iso;
  const isUpcoming = date ? new Date(date).getTime() >= Date.now() : false;
  return (
    <div className="mt-auto flex items-center justify-between gap-2 border-t border-base-300/60 pt-2">
      <span className="text-[11px] text-base-content/45">
        {isUpcoming ? `Próxima · ${relativeTime(date)}` : `Pasada · ${relativeTime(date)}`}
      </span>
      {appointment.request_id ? (
        <Link to={`/requests/${appointment.request_id}`} className="btn btn-ghost btn-xs gap-1">
          <Send className="h-3.5 w-3.5" />
          Ver solicitud
        </Link>
      ) : null}
    </div>
  );
}

function AppointmentCard({ appointment }: { appointment: Appointment }) {
  return (
    <article className="vl-card flex flex-col gap-2 p-4">
      <AppointmentSchedule appointment={appointment} />
      <AppointmentPeople appointment={appointment} />
      <AppointmentMotivo motivo={appointment.motivo} />
      <AppointmentFooter appointment={appointment} />
    </article>
  );
}

function CalendarEmpty() {
  return (
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
  );
}

function AppointmentsBody({ query }: { query: ReturnType<typeof useAppointments> }) {
  if (query.isLoading) return <LoadingCards count={3} />;
  if (query.isError) {
    return (
      <ErrorState
        error={query.error}
        title="No se pudo cargar el calendario"
        onRetry={() => query.refetch()}
      />
    );
  }
  const appointments = sortAppointments(query.data?.appointments);
  if (appointments.length === 0) return <CalendarEmpty />;
  return (
    <>
      <CardGrid>
        {appointments.map((appointment) => (
          <AppointmentCard key={appointment.id} appointment={appointment} />
        ))}
      </CardGrid>
      <p className="text-center text-[11px] text-base-content/35">
        {appointments.length} {appointments.length === 1 ? 'cita' : 'citas'} · hora local
        Europe/Madrid
      </p>
    </>
  );
}

function CalendarHeader({ specialistRole }: { specialistRole: boolean }) {
  return (
    <PageHeader
      heading={{
        eyebrow: 'Agenda',
        title: 'Calendario',
        description: specialistRole
          ? 'Tus visitas aceptadas, en orden cronológico.'
          : 'Visitas de la clínica confirmadas con especialistas.',
        icon: CalendarDays,
      }}
    >
      <div className="flex flex-wrap gap-2">
        <Link to="/requests" className="btn btn-outline btn-sm gap-1.5">
          <Send className="h-4 w-4" />
          Solicitudes
        </Link>
        <Link
          to={specialistRole ? '/specialists' : '/patients'}
          className="btn btn-ghost btn-sm gap-1.5"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver
        </Link>
      </div>
    </PageHeader>
  );
}

export function Calendar() {
  const specialistRole = useIsSpecialist();
  const query = useAppointments();

  return (
    <div className="space-y-6">
      <CalendarHeader specialistRole={specialistRole} />
      <AppointmentsBody query={query} />
    </div>
  );
}

export default Calendar;
