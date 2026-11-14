import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Send } from 'lucide-react';
import { BackLink } from '../components/BackLink';
import { EmptyState, ErrorState } from '../components/EmptyState';
import { Loading } from '../components/Loading';
import { PageTitle } from '../components/PageHeader';
import {
  PatientSpecialistSection,
  PreferredSlotsSection,
  ReasonSection,
  ShareLevelSection,
} from '../components/request-new/RequestSections';
import { RequestSummaryPanel } from '../components/request-new/RequestSummaryPanel';
import { useCreateRequest, usePatients } from '../api/hooks';
import { useRequestFormState } from '../hooks/useRequestFormState';
import {
  buildCreatePayload,
  readRequestPresets,
  type RequestFormState,
  type RequestPresets,
} from '../lib/requests';

function NoPatientsState() {
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

function RequestFormIntro({ patientId }: { patientId: string }) {
  return (
    <>
      <BackLink to={patientId ? `/patients/${patientId}` : '/patients'}>Volver</BackLink>
      <header>
        <PageTitle
          heading={{
            eyebrow: 'VetNetwork · derivación',
            title: 'Nueva solicitud',
            description:
              'El especialista recibirá primero un resumen no identificativo. La historia completa se abre cuando acepta.',
            icon: Send,
          }}
        />
      </header>
    </>
  );
}

interface RequestAsideState {
  form: RequestFormState;
  canSubmit: boolean;
  mutation: ReturnType<typeof useCreateRequest>;
  onPreferredTextChange: (value: string) => void;
}

function RequestFormAside({ state }: { state: RequestAsideState }) {
  return (
    <aside className="space-y-4">
      <PreferredSlotsSection
        presetSlot={state.form.presetSlot}
        value={state.form.preferredText}
        onChange={state.onPreferredTextChange}
      />
      <RequestSummaryPanel
        form={state.form}
        canSubmit={state.canSubmit}
        mutation={state.mutation}
      />
    </aside>
  );
}

function RequestForm({ presets }: { presets: RequestPresets }) {
  const navigate = useNavigate();
  const createRequest = useCreateRequest();
  const { form, update, canSubmit } = useRequestFormState(presets);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    update({ touched: true });
    if (!canSubmit) return;
    createRequest.mutate(buildCreatePayload(form), {
      onSuccess: (data) => {
        const id = data?.request?.id;
        navigate(id ? `/requests/${id}` : '/requests');
      },
    });
  };

  return (
    <div className="space-y-6">
      <RequestFormIntro patientId={form.patientId} />
      <form onSubmit={submit} className="grid gap-5 lg:grid-cols-[1.35fr_1fr]">
        <div className="space-y-4">
          <PatientSpecialistSection form={form} onUpdate={update} />
          <ReasonSection form={form} onUpdate={update} />
          <ShareLevelSection
            value={form.shareLevel}
            onChange={(shareLevel) => update({ shareLevel })}
          />
        </div>
        <RequestFormAside
          state={{
            form,
            canSubmit,
            mutation: createRequest,
            onPreferredTextChange: (preferredText) => update({ preferredText }),
          }}
        />
      </form>
    </div>
  );
}

export function RequestNew() {
  const [searchParams] = useSearchParams();
  const patientsQuery = usePatients();

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
  if (!patientsQuery.data?.patients?.length) return <NoPatientsState />;
  return <RequestForm presets={readRequestPresets(searchParams)} />;
}

export default RequestNew;
