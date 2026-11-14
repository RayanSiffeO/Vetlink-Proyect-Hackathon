import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  CalendarClock,
  Send,
  ShieldCheck,
  Stethoscope,
  UserRound,
} from 'lucide-react';
import { EmptyState, ErrorState } from '../components/EmptyState';
import { Loading } from '../components/Loading';
import { URGENCY_OPTIONS, useCreateRequest, usePatients, useSpecialists } from '../api/hooks';
import type { ShareLevel, Urgency } from '../api/types';
import {
  ageFromBirthDate,
  formatPrice,
  shareLevelHint,
  shareLevelLabel,
} from '../lib/format';

const EMPTY_MOTIVO_MIN = 10;

export function RequestNew() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const presetPatient = searchParams.get('patient_id') ?? '';
  const presetSpecialist = searchParams.get('specialist_id') ?? '';
  const presetSlot = searchParams.get('slot') ?? '';

  const patientsQuery = usePatients();
  const specialistsQuery = useSpecialists('', '');
  const createRequest = useCreateRequest();

  const [patientId, setPatientId] = useState(presetPatient);
  const [specialistId, setSpecialistId] = useState(presetSpecialist);
  const [motivo, setMotivo] = useState('');
  const [urgencia, setUrgencia] = useState<Urgency>('MEDIA');
  const [shareLevel, setShareLevel] = useState<ShareLevel>('CLINICAL');
  const [preferredText, setPreferredText] = useState('');
  const [touched, setTouched] = useState(false);

  const patients = patientsQuery.data?.patients ?? [];
  const specialists = specialistsQuery.data?.specialists ?? [];

  const selectedPatient = useMemo(
    () => patients.find((patient) => patient.id === patientId) ?? null,
    [patients, patientId],
  );
  const selectedSpecialist = useMemo(
    () => specialists.find((specialist) => specialist.id === specialistId) ?? null,
    [specialists, specialistId],
  );

  const motivoError =
    touched && motivo.trim().length < EMPTY_MOTIVO_MIN
      ? `Describe el motivo (mínimo ${EMPTY_MOTIVO_MIN} caracteres).`
      : null;
  const canSubmit = patientId && specialistId && motivo.trim().length >= EMPTY_MOTIVO_MIN;

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setTouched(true);
    if (!canSubmit) return;

    const preferredParts = [
      ...(presetSlot ? [presetSlot] : []),
      ...preferredText
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean),
    ];

    createRequest.mutate(
      {
        patient_id: patientId,
        specialist_id: specialistId,
        motivo: motivo.trim(),
        urgencia,
        share_level: shareLevel,
        // La API guarda `preferred` como texto libre.
        preferred: preferredParts.join(', '),
      },
      {
        onSuccess: (data) => {
          const id = data?.request?.id;
          navigate(id ? `/requests/${id}` : '/requests');
        },
      },
    );
  };

  if (patientsQuery.isLoading) return <Loading label="Preparando la solicitud…" />;

  if (patientsQuery.isError) {
    return (
      <ErrorState
        error={patientsQuery.error}
        title="No se pudieron cargar los pacientes"
        onRetry={() => patientsQuery.refetch()}
      />
    );
  }

  if (patients.length === 0) {
    return (
      <EmptyState
        title="Necesitas un paciente para derivar"
        description="Importa una historia clínica o carga los datos de demo desde la pantalla de pacientes."
        action={
          <Link to="/patients" className="btn btn-primary btn-sm">
            Ir a pacientes
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <Link
        to={patientId ? `/patients/${patientId}` : '/patients'}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-base-content/55 hover:text-secondary"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver
      </Link>

      <header>
        <p className="vl-section-title">VetNetwork · derivación</p>
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Send className="h-6 w-6 text-secondary" aria-hidden="true" />
          Nueva solicitud
        </h1>
        <p className="mt-1 text-sm text-base-content/55">
          El especialista recibirá primero un resumen no identificativo. La historia completa se
          abre cuando acepta.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="grid gap-5 lg:grid-cols-[1.35fr_1fr]">
        <div className="space-y-4">
          {/* Paciente y especialista */}
          <section className="vl-card space-y-4 p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <UserRound className="h-4 w-4 text-secondary" />
              Paciente y especialista
            </h2>

            <label className="block">
              <span className="vl-label">Paciente</span>
              <select
                className="select select-bordered select-sm mt-1 h-10 w-full"
                value={patientId}
                onChange={(event) => setPatientId(event.target.value)}
                required
              >
                <option value="">Selecciona un paciente…</option>
                {patients.map((patient) => (
                  <option key={patient.id} value={patient.id}>
                    {patient.name} · {patient.species ?? '—'} ·{' '}
                    {ageFromBirthDate(patient.birth_date)}
                  </option>
                ))}
              </select>
              {selectedPatient ? (
                <span className="mt-1 block text-[11px] text-base-content/45">
                  {[selectedPatient.breed, selectedPatient.owner_display]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              ) : null}
            </label>

            <label className="block">
              <span className="vl-label">Especialista</span>
              <select
                className="select select-bordered select-sm mt-1 h-10 w-full"
                value={specialistId}
                onChange={(event) => setSpecialistId(event.target.value)}
                required
                disabled={specialistsQuery.isLoading}
              >
                <option value="">
                  {specialistsQuery.isLoading ? 'Cargando especialistas…' : 'Selecciona especialista…'}
                </option>
                {specialists.map((specialist) => (
                  <option key={specialist.id} value={specialist.id}>
                    {specialist.name} · {specialist.specialty} · {specialist.zone}
                  </option>
                ))}
              </select>
              {specialistsQuery.isError ? (
                <span className="mt-1 block text-[11px] text-error">
                  No se pudo cargar el marketplace: {specialistsQuery.error.message}
                </span>
              ) : null}
              {selectedSpecialist ? (
                <span className="mt-1 flex items-center gap-2 text-[11px] text-base-content/45">
                  <Stethoscope className="h-3 w-3" />
                  {selectedSpecialist.specialty} · {selectedSpecialist.zone} · desde{' '}
                  {formatPrice(selectedSpecialist.price_from)}
                </span>
              ) : null}
            </label>
          </section>

          {/* Motivo y urgencia */}
          <section className="vl-card space-y-4 p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <AlertCircle className="h-4 w-4 text-secondary" />
              Motivo de la derivación
            </h2>

            <label className="block">
              <span className="vl-label">Motivo / observaciones</span>
              <textarea
                className={`textarea textarea-bordered mt-1 min-h-[104px] w-full text-sm ${
                  motivoError ? 'textarea-error' : ''
                }`}
                placeholder="Ej.: cojera intermitente en miembro posterior derecho de 3 semanas de evolución, sin respuesta a analgesia."
                value={motivo}
                onChange={(event) => {
                  setMotivo(event.target.value);
                  setTouched(true);
                }}
                maxLength={600}
              />
              <span className="mt-1 flex items-center justify-between text-[11px] text-base-content/40">
                <span>{motivoError ?? `${motivo.length}/600 caracteres`}</span>
                <span>Se comparte con el especialista</span>
              </span>
            </label>

            <fieldset>
              <legend className="vl-label">Urgencia</legend>
              <div className="mt-1.5 grid gap-2 sm:grid-cols-3">
                {URGENCY_OPTIONS.map((option) => (
                  <label
                    key={option.value}
                    className={`cursor-pointer rounded-xl border px-3 py-2 transition-colors ${
                      urgencia === option.value
                        ? 'border-secondary bg-secondary/5'
                        : 'border-base-300 hover:border-secondary/40'
                    }`}
                  >
                    <span className="flex items-center gap-2 text-sm font-medium">
                      <input
                        type="radio"
                        name="urgencia"
                        className="radio radio-xs radio-secondary"
                        value={option.value}
                        checked={urgencia === option.value}
                        onChange={() => setUrgencia(option.value)}
                      />
                      {option.label}
                    </span>
                    <span className="mt-0.5 block text-[11px] leading-snug text-base-content/45">
                      {option.hint}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          </section>

          {/* Nivel de compartición */}
          <section className="vl-card space-y-3 p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <ShieldCheck className="h-4 w-4 text-secondary" />
              Nivel de compartición
            </h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {(['CLINICAL', 'FULL'] as ShareLevel[]).map((level) => (
                <label
                  key={level}
                  className={`cursor-pointer rounded-xl border px-3 py-2 transition-colors ${
                    shareLevel === level
                      ? 'border-primary bg-primary/5'
                      : 'border-base-300 hover:border-primary/40'
                  }`}
                >
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <input
                      type="radio"
                      name="share_level"
                      className="radio radio-xs radio-primary"
                      value={level}
                      checked={shareLevel === level}
                      onChange={() => setShareLevel(level)}
                    />
                    {shareLevelLabel(level)}
                  </span>
                  <span className="mt-0.5 block text-[11px] leading-snug text-base-content/45">
                    {shareLevelHint(level)}
                  </span>
                </label>
              ))}
            </div>
          </section>
        </div>

        {/* Resumen lateral */}
        <aside className="space-y-4">
          <section className="vl-card space-y-3 p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <CalendarClock className="h-4 w-4 text-secondary" />
              Franjas preferidas
            </h2>
            {presetSlot ? (
              <p className="rounded-lg bg-secondary/10 px-2.5 py-1.5 text-[11px] text-secondary">
                Franja del especialista: {new Date(presetSlot).toLocaleString('es-ES')}
              </p>
            ) : null}
            <label className="block">
              <span className="vl-label">Fechas o franjas (separadas por comas)</span>
              <input
                type="text"
                className="input input-bordered input-sm mt-1 h-10 w-full"
                placeholder="Ej.: martes tarde, jueves mañana"
                value={preferredText}
                onChange={(event) => setPreferredText(event.target.value)}
              />
            </label>
            <p className="text-[11px] leading-snug text-base-content/45">
              Opcional. El especialista confirmará una franja concreta al aceptar la solicitud.
            </p>
          </section>

          <section className="vl-card space-y-2 p-5">
            <h2 className="text-sm font-semibold">Resumen</h2>
            <dl className="space-y-1.5 text-[12px]">
              <div className="flex justify-between gap-2">
                <dt className="text-base-content/50">Paciente</dt>
                <dd className="truncate font-medium">{selectedPatient?.name ?? '—'}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-base-content/50">Especialista</dt>
                <dd className="truncate font-medium">{selectedSpecialist?.name ?? '—'}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-base-content/50">Urgencia</dt>
                <dd className="font-medium">
                  {URGENCY_OPTIONS.find((option) => option.value === urgencia)?.label ?? urgencia}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-base-content/50">Compartición</dt>
                <dd className="font-medium">{shareLevel}</dd>
              </div>
            </dl>

            {createRequest.isError ? (
              <div className="alert alert-error mt-2 items-start p-2 text-[12px]" role="alert">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{createRequest.error.message}</span>
              </div>
            ) : null}

            <button
              type="submit"
              className="btn btn-primary mt-2 w-full gap-1.5"
              disabled={createRequest.isPending || !canSubmit}
            >
              {createRequest.isPending ? (
                <span className="loading loading-spinner loading-sm" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Enviar solicitud
            </button>
            {!canSubmit ? (
              <p className="text-center text-[11px] text-base-content/40">
                Selecciona paciente y especialista y escribe el motivo.
              </p>
            ) : null}
          </section>
        </aside>
      </form>
    </div>
  );
}

export default RequestNew;
