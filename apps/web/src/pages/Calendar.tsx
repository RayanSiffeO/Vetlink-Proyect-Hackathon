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
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/badges';
import { useAppointments, useIsSpecialist } from '../api/hooks';
import type { Appointment } from '../api/types';
import { formatDateTime, formatWeekday, relativeTime } from '../lib/format';
import { sortAppointments } from '../lib/appointments';

function AppointmentSchedule({ appointment }: { appointment: Appointment }) {
  const date = appointment.when_iso;
  return (
    <div className="flex items-center gap-3">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-100">
        <CalendarDays className="h-5 w-5" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-[10.5px] font-medium uppercase tracking-[0.1em] leading-4 text-indigo-700">
          {formatWeekday(date)}
        </p>
        <p className="truncate text-[13px] font-medium leading-5 text-ink">{formatDateTime(date)}</p>
      </div>
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
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] leading-[18px] text-para">
      {patient ? (
        <span className="inline-flex items-center gap-1">
          <UserRound className="h-3.5 w-3.5 text-indigo-300" aria-hidden="true" />
          {patient}
        </span>
      ) : null}
      {specialist ? (
        <span className="inline-flex items-center gap-1">
          <Stethoscope className="h-3.5 w-3.5 text-indigo-300" aria-hidden="true" />
          {specialist}
          {specialtySuffix}
        </span>
      ) : null}
      {!patient && !specialist ? (
        <span className="inline-flex items-center gap-1">
          <Clock3 className="h-3.5 w-3.5 text-indigo-300" aria-hidden="true" />
          Cita {String(appointment.id).slice(0, 8)}
        </span>
      ) : null}
    </div>
  );
}

function AppointmentMotivo({ motivo }: { motivo?: string | null }) {
  if (!motivo) return null;
  return <p className="line-clamp-2 text-[12px] leading-[18px] text-caption">{motivo}</p>;
}

function AppointmentFooter({ appointment }: { appointment: Appointment }) {
  const date = appointment.when_iso;
  const isUpcoming = date ? new Date(date).getTime() >= Date.now() : false;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[10.5px] leading-4 text-caption">
        {isUpcoming ? `Próxima · ${relativeTime(date)}` : `Pasada · ${relativeTime(date)}`}
      </span>
      {appointment.request_id ? (
        <Link
          to={`/requests/${appointment.request_id}`}
          className="inline-flex items-center gap-1 rounded-full border border-line bg-white/70 px-2.5 py-1 text-[10.5px] font-medium leading-4 text-indigo-700 transition duration-200 ease-smooth hover:-translate-y-px hover:border-indigo-300 hover:bg-white"
        >
          <Send className="h-3 w-3" aria-hidden="true" />
          Ver solicitud
        </Link>
      ) : null}
    </div>
  );
}

function AppointmentRow({ appointment }: { appointment: Appointment }) {
  return (
    <li className="grid gap-3 px-5 py-4 transition-colors duration-200 ease-smooth hover:bg-white/35 sm:grid-cols-[minmax(0,200px)_minmax(0,1fr)_auto] sm:items-center">
      <AppointmentSchedule appointment={appointment} />
      <div className="min-w-0 space-y-1">
        <AppointmentPeople appointment={appointment} />
        <AppointmentMotivo motivo={appointment.motivo} />
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:flex-col sm:items-end">
        <StatusBadge status={appointment.status} variant="plain" />
        <AppointmentFooter appointment={appointment} />
      </div>
    </li>
  );
}

function CalendarEmpty() {
  return (
    <EmptyState
      title="Sin citas en la agenda"
      description="Cuando una solicitud se acepte con una franja concreta, la cita aparecerá aquí."
      icon={<CalendarClock className="h-6 w-6" />}
      action={
        <Link to="/requests" className="btn border-0 bg-ink text-cream hover:bg-\[\#3A2E26\] btn-sm">
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
      <section className="glass overflow-hidden rounded-panel" aria-label="Agenda de visitas">
        <ul className="divide-y divide-white/60">
          {appointments.map((appointment) => (
            <AppointmentRow key={appointment.id} appointment={appointment} />
          ))}
        </ul>
      </section>
      <p className="text-center text-[11px] leading-4 text-caption/80">
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
        <Link
          to="/requests"
          className="inline-flex items-center gap-1.5 rounded-full border border-line-strong bg-white/70 px-3 py-1.5 text-[12px] font-medium text-para transition duration-200 ease-smooth hover:-translate-y-0.5 hover:border-indigo-300 hover:text-indigo-700"
        >
          <Send className="h-3.5 w-3.5" />
          Solicitudes
        </Link>
        <Link
          to={specialistRole ? '/requests' : '/patients'}
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium text-caption transition duration-200 ease-smooth hover:-translate-y-px hover:bg-white/70 hover:text-indigo-700"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
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
