import { Link } from 'react-router-dom';
import { Loader2, RotateCcw, Search, Stethoscope, Users } from 'lucide-react';
import { EmptyState, ErrorState } from '../components/EmptyState';
import { LoadingCards } from '../components/Loading';
import { CardGrid } from '../components/CardGrid';
import { ImportSection } from '../components/patients/ImportSection';
import { PatientCard } from '../components/patients/PatientCard';
import { usePatients, useResetDemo } from '../api/hooks';
import { formatDate } from '../lib/format';
import { countPatientAlerts } from '../lib/patients';

interface DemoAction {
  pending: boolean;
  onLoad: () => void;
}

function DemoLoadButton({ demo }: { demo: DemoAction }) {
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white/60 px-3 py-1.5 text-[12px] font-medium text-para transition duration-200 ease-smooth hover:-translate-y-px hover:border-indigo-300 hover:bg-white hover:text-indigo-700 disabled:opacity-60"
      onClick={demo.onLoad}
      disabled={demo.pending}
      title="Reinicia la base de demo (POST /api/demo/reset)"
    >
      {demo.pending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <RotateCcw className="h-3.5 w-3.5" />
      )}
      Cargar demo
    </button>
  );
}

function HeroStat({
  value,
  label,
  tone = 'text-ink',
}: {
  value: number | string;
  label: string;
  tone?: string;
}) {
  return (
    <div className="min-w-[92px] rounded-[22px] border border-white/60 bg-white/55 px-4 py-3 text-center shadow-soft">
      <p className={`text-[32px] font-medium leading-none tracking-[-0.03em] ${tone}`}>{value}</p>
      <p className="vl-label mt-1">{label}</p>
    </div>
  );
}

function PatientsHeader({
  count,
  alertCount,
  demo,
  state,
}: {
  count: number;
  alertCount: number;
  demo: DemoAction;
  state: 'loading' | 'error' | 'ready';
}) {
  const description =
    state === 'loading'
      ? 'Cargando la bandeja de la clínica…'
      : state === 'error'
        ? 'No se pudo cargar la bandeja. Revisa la conexión y reintenta.'
        : count > 0
          ? `${count} pacientes · ${alertCount} alertas activas en la bandeja de la clínica.`
          : 'Sube historias clínicas y VetLink construye el registro canónico.';
  const display = state === 'ready' ? count : '—';
  const alertDisplay = state === 'ready' ? alertCount : '—';
  return (
    <section className="glass relative overflow-hidden rounded-panel px-5 py-6 sm:px-8 sm:py-8">
      <span className="dash-ring dash-ring-lg" aria-hidden="true" />
      <span className="dash-ring dash-ring-sm" aria-hidden="true" />
      <div className="relative z-10 grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div>
          <p className="vl-section-title text-indigo-700">VetRecord · clínica</p>
          <h1 className="mt-2 flex items-center gap-3 text-[clamp(34px,4vw,52px)] font-medium leading-[1.02] tracking-[-0.03em] text-ink">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-100">
              <Users className="h-5 w-5" aria-hidden="true" />
            </span>
            Pacientes
          </h1>
          <p className="mt-2 max-w-xl text-[13px] leading-5 text-para">{description}</p>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <DemoLoadButton demo={demo} />
            <Link
              to="/specialists"
              className="inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-[12px] font-medium text-cream shadow-lift transition duration-200 ease-smooth hover:-translate-y-0.5 hover:bg-[#3A2E26]"
            >
              <Stethoscope className="h-3.5 w-3.5" />
              Buscar especialista
            </Link>
          </div>
        </div>
        <div className="flex items-stretch gap-2">
          <HeroStat value={count} label={count === 1 ? 'paciente' : 'pacientes'} />
          <HeroStat
            value={alertCount}
            label={alertCount === 1 ? 'alerta activa' : 'alertas activas'}
            tone="text-crit"
          />
        </div>
      </div>
    </section>
  );
}

function PatientsEmpty({ onLoadDemo }: { onLoadDemo: () => void }) {
  return (
    <EmptyState
      title="Todavía no hay pacientes"
      description="Sube una historia clínica (.docx, .xlsx o .json) para crear el primer registro canónico."
      icon={<Search className="h-6 w-6" />}
      action={
        <button type="button" className="btn border-0 bg-ink text-cream hover:bg-\[\#3A2E26\] btn-sm gap-1.5" onClick={onLoadDemo}>
          <RotateCcw className="h-4 w-4" /> Cargar datos de demo
        </button>
      }
    />
  );
}

function PatientsList({
  query,
  onLoadDemo,
}: {
  query: ReturnType<typeof usePatients>;
  onLoadDemo: () => void;
}) {
  if (query.isLoading) return <LoadingCards count={3} />;
  if (query.isError) {
    return (
      <ErrorState
        error={query.error}
        title="No se pudieron cargar los pacientes"
        onRetry={() => query.refetch()}
        hint="Si la API no está arrancada, el login demo tampoco funcionará"
      />
    );
  }
  const patients = query.data?.patients ?? [];
  if (patients.length === 0) return <PatientsEmpty onLoadDemo={onLoadDemo} />;
  return (
    <CardGrid>
      {patients.map((patient) => (
        <PatientCard key={patient.id} patient={patient} />
      ))}
    </CardGrid>
  );
}

export function Patients() {
  const query = usePatients();
  const resetDemo = useResetDemo();
  const patients = query.data?.patients ?? [];
  const loadDemo = () => resetDemo.mutate(undefined, { onSuccess: () => query.refetch() });
  const state = query.isLoading ? 'loading' : query.isError ? 'error' : 'ready';

  return (
    <div className="space-y-6">
      <PatientsHeader
        count={patients.length}
        alertCount={countPatientAlerts(patients)}
        demo={{ pending: resetDemo.isPending, onLoad: loadDemo }}
        state={state}
      />
      <ImportSection />
      <section aria-label="Pacientes de la clínica" className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="vl-section-title">Bandeja clínica</p>
            <h2 className="mt-1 text-h2 text-ink">Pacientes recientes</h2>
          </div>
          <span className="rounded-full border border-line bg-white/50 px-3 py-1 text-[11px] text-caption">
            {state === 'ready'
              ? `${patients.length} fichas · orden por alerta`
              : state === 'loading'
                ? 'Cargando fichas…'
                : 'Fichas no disponibles'}
          </span>
        </div>
        <PatientsList query={query} onLoadDemo={loadDemo} />
      </section>
      {state === 'ready' ? (
        <p className="text-center text-[11px] text-caption/80">
          Última sincronización {formatDate(new Date().toISOString())} · registro canónico VetLink
        </p>
      ) : null}
    </div>
  );
}

export default Patients;

