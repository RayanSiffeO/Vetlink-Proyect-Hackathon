import { Link } from 'react-router-dom';
import { Loader2, RotateCcw, Search, Stethoscope, Users } from 'lucide-react';
import { EmptyState, ErrorState } from '../components/EmptyState';
import { LoadingCards } from '../components/Loading';
import { CardGrid } from '../components/CardGrid';
import { PageHeader } from '../components/PageHeader';
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

function PatientStat({
  value,
  label,
  tone = 'text-ink',
}: {
  value: number;
  label: string;
  tone?: string;
}) {
  return (
    <div className="min-w-[76px] rounded-2xl border border-line bg-mist/75 px-3 py-1.5 text-center">
      <p className={`text-[20px] font-medium leading-6 tracking-[-0.02em] ${tone}`}>{value}</p>
      <p className="vl-label mt-0.5">{label}</p>
    </div>
  );
}

function PatientsHeader({
  count,
  alertCount,
  demo,
}: {
  count: number;
  alertCount: number;
  demo: DemoAction;
}) {
  return (
    <PageHeader
      heading={{
        eyebrow: 'VetRecord · clínica',
        title: 'Pacientes',
        description:
          count > 0
            ? `${count} pacientes · ${alertCount} alertas activas`
            : 'Sube historias clínicas y VetLink construye el registro canónico.',
        icon: Users,
      }}
    >
      <div className="flex w-full flex-col gap-2.5 sm:w-auto sm:items-end">
        <div className="flex items-stretch gap-2">
          <PatientStat value={count} label={count === 1 ? 'paciente' : 'pacientes'} />
          <PatientStat
            value={alertCount}
            label={alertCount === 1 ? 'alerta activa' : 'alertas activas'}
            tone="text-crit"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DemoLoadButton demo={demo} />
          <Link
            to="/specialists"
            className="inline-flex items-center gap-1.5 rounded-full bg-indigo px-3.5 py-1.5 text-[12px] font-medium text-ink shadow-lift transition duration-200 ease-smooth hover:-translate-y-0.5 hover:bg-indigo-300"
          >
            <Stethoscope className="h-3.5 w-3.5" />
            Buscar especialista
          </Link>
        </div>
      </div>
    </PageHeader>
  );
}

function PatientsEmpty({ onLoadDemo }: { onLoadDemo: () => void }) {
  return (
    <EmptyState
      title="Todavía no hay pacientes"
      description="Sube una historia clínica (.docx, .xlsx o .json) para crear el primer registro canónico."
      icon={<Search className="h-6 w-6" />}
      action={
        <button type="button" className="btn btn-primary btn-sm gap-1.5" onClick={onLoadDemo}>
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

  return (
    <div className="space-y-6">
      <PatientsHeader
        count={patients.length}
        alertCount={countPatientAlerts(patients)}
        demo={{ pending: resetDemo.isPending, onLoad: loadDemo }}
      />
      <ImportSection />
      <section aria-label="Pacientes de la clínica">
        <PatientsList query={query} onLoadDemo={loadDemo} />
      </section>
      <p className="text-center text-[11px] text-caption/80">
        Última sincronización {formatDate(new Date().toISOString())} · registro canónico VetLink
      </p>
    </div>
  );
}

export default Patients;
