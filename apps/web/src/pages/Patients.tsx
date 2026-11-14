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
      className="btn btn-ghost btn-sm gap-1.5 text-base-content/50"
      onClick={demo.onLoad}
      disabled={demo.pending}
      title="Reinicia la base de demo (POST /api/demo/reset)"
    >
      {demo.pending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <RotateCcw className="h-4 w-4" />
      )}
      Cargar demo
    </button>
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
      <div className="flex items-center gap-2">
        <DemoLoadButton demo={demo} />
        <Link to="/specialists" className="btn btn-outline btn-sm gap-1.5">
          <Stethoscope className="h-4 w-4" />
          Buscar especialista
        </Link>
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
      <p className="text-center text-[11px] text-base-content/35">
        Última sincronización {formatDate(new Date().toISOString())} · registro canónico VetLink
      </p>
    </div>
  );
}

export default Patients;
