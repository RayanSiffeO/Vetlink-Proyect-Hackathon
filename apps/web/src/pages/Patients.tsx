import { useCallback, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  FileSpreadsheet,
  FileText,
  FileUp,
  Loader2,
  RotateCcw,
  Search,
  Stethoscope,
  UploadCloud,
  Users,
  XCircle,
} from 'lucide-react';
import { EmptyState, ErrorState } from '../components/EmptyState';
import { LoadingCards } from '../components/Loading';
import { useImportFiles, usePatients, useResetDemo } from '../api/hooks';
import type { ImportFileResult, PatientSummary } from '../api/types';
import {
  ageFromBirthDate,
  formatDate,
  formatWeight,
  initials,
} from '../lib/format';

const ACCEPT = {
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'application/json': ['.json'],
};

function importStatusStyle(status: string) {
  switch (String(status).toUpperCase()) {
    case 'READY':
      return { label: 'Listo', badge: 'badge-success', icon: CheckCircle2 };
    case 'NEEDS_REVIEW':
      return { label: 'Revisar', badge: 'badge-warning', icon: AlertTriangle };
    case 'FAILED':
      return { label: 'Fallido', badge: 'badge-error', icon: XCircle };
    default:
      return { label: status, badge: 'badge-ghost', icon: Clock3 };
  }
}

function PatientCard({ patient }: { patient: PatientSummary }) {
  const alerts = Number(patient.alerts_count ?? 0);
  const hasAlerts = alerts > 0;
  const confidence =
    patient.identity_confidence === null || patient.identity_confidence === undefined
      ? null
      : Math.round(Number(patient.identity_confidence) * 100);

  return (
    <article className="vl-card flex flex-col gap-3 p-4 transition-shadow hover:shadow-card">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-sm font-bold text-primary">
          {initials(patient.name)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-base font-semibold">{patient.name}</h3>
            {hasAlerts ? (
              <span className="badge badge-error badge-sm gap-1 font-semibold">
                <AlertTriangle className="h-3 w-3" />
                {alerts} {alerts === 1 ? 'alerta' : 'alertas'}
              </span>
            ) : (
              <span className="badge badge-success badge-sm gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Sin alertas
              </span>
            )}
          </div>
          <p className="mt-0.5 truncate text-[13px] text-base-content/55">
            {[patient.species, patient.breed].filter(Boolean).join(' · ') || 'Especie sin definir'}
          </p>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-[12px]">
        <div>
          <dt className="vl-label">Edad</dt>
          <dd className="vl-value">{ageFromBirthDate(patient.birth_date)}</dd>
        </div>
        <div>
          <dt className="vl-label">Peso</dt>
          <dd className="vl-value">{formatWeight(patient.weight_current_kg)}</dd>
        </div>
        <div>
          <dt className="vl-label">BCS</dt>
          <dd className="vl-value">{patient.bcs ?? '—'}</dd>
        </div>
        <div>
          <dt className="vl-label">Tutor</dt>
          <dd className="truncate vl-value">{patient.owner_display ?? '—'}</dd>
        </div>
      </dl>

      <div className="flex items-center justify-between gap-2 border-t border-base-300/60 pt-2.5">
        <div className="min-w-0 text-[11px] text-base-content/45">
          {confidence !== null ? (
            <span className="inline-flex items-center gap-1.5">
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  confidence >= 80 ? 'bg-success' : confidence >= 50 ? 'bg-warning' : 'bg-error'
                }`}
              />
              Identidad {confidence}%
            </span>
          ) : (
            <span>Microchip {patient.microchip ?? '—'}</span>
          )}
        </div>
        <Link to={`/patients/${patient.id}`} className="btn btn-primary btn-sm gap-1.5">
          Ver ficha
        </Link>
      </div>
    </article>
  );
}

function ImportResultRow({ file }: { file: ImportFileResult }) {
  const style = importStatusStyle(file.status);
  const Icon = style.icon;
  return (
    <li className="flex items-start gap-2 rounded-xl border border-base-300/70 bg-base-100 px-3 py-2">
      <Icon
        className={`mt-0.5 h-4 w-4 shrink-0 ${
          style.badge === 'badge-success'
            ? 'text-success'
            : style.badge === 'badge-warning'
              ? 'text-warning'
              : style.badge === 'badge-error'
                ? 'text-error'
                : 'text-base-content/40'
        }`}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium">{file.filename}</p>
        {file.message ? (
          <p className="text-[11px] leading-snug text-base-content/50">{file.message}</p>
        ) : null}
      </div>
      <span className={`badge badge-sm shrink-0 ${style.badge}`}>{style.label}</span>
    </li>
  );
}

export function Patients() {
  const { data, isLoading, isError, error, refetch } = usePatients();
  const importFiles = useImportFiles();
  const resetDemo = useResetDemo();
  const navigate = useNavigate();
  const [rejected, setRejected] = useState<string[]>([]);

  const onDrop = useCallback(
    (accepted: File[]) => {
      setRejected([]);
      if (accepted.length > 0) importFiles.mutate(accepted);
    },
    [importFiles],
  );

  const onDropRejected = useCallback((files: { file: File }[]) => {
    setRejected(files.map((item) => item.file.name));
  }, []);

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    onDropRejected,
    accept: ACCEPT,
    multiple: true,
    noClick: true,
    noKeyboard: true,
  });

  const patients = data?.patients ?? [];
  const totalAlerts = useMemo(
    () => patients.reduce((sum, patient) => sum + Number(patient.alerts_count ?? 0), 0),
    [patients],
  );

  const handleLoadDemo = () => {
    resetDemo.mutate(undefined, { onSuccess: () => refetch() });
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="vl-section-title">VetRecord · clínica</p>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Users className="h-6 w-6 text-secondary" aria-hidden="true" />
            Pacientes
          </h1>
          <p className="mt-1 text-sm text-base-content/55">
            {patients.length > 0
              ? `${patients.length} pacientes · ${totalAlerts} alertas activas`
              : 'Sube historias clínicas y VetLink construye el registro canónico.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="btn btn-ghost btn-sm gap-1.5 text-base-content/50"
            onClick={handleLoadDemo}
            disabled={resetDemo.isPending}
            title="Reinicia la base de demo (POST /api/demo/reset)"
          >
            {resetDemo.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RotateCcw className="h-4 w-4" />
            )}
            Cargar demo
          </button>
          <Link to="/specialists" className="btn btn-outline btn-sm gap-1.5">
            <Stethoscope className="h-4 w-4" />
            Buscar especialista
          </Link>
        </div>
      </header>

      {/* Zona de importación */}
      <section
        {...getRootProps()}
        className={`vl-card border-dashed p-5 transition-colors ${
          isDragActive ? 'border-secondary bg-secondary/5' : ''
        }`}
        aria-label="Importar historias clínicas"
      >
        <input {...getInputProps()} aria-label="Seleccionar ficheros de historia clínica" />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-secondary/10 text-secondary">
              <UploadCloud className="h-6 w-6" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-sm font-semibold">Importar historia clínica</h2>
              <p className="text-[12px] text-base-content/55">
                Arrastra los ficheros o selecciónalos · Word, Excel y JSON
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
            <span className="badge badge-ghost badge-sm gap-1">
              <FileText className="h-3 w-3" /> .docx
            </span>
            <span className="badge badge-ghost badge-sm gap-1">
              <FileSpreadsheet className="h-3 w-3" /> .xlsx
            </span>
            <span className="badge badge-ghost badge-sm gap-1">
              <FileUp className="h-3 w-3" /> .json
            </span>
            <button
              type="button"
              className="btn btn-secondary btn-sm gap-1.5"
              onClick={open}
              disabled={importFiles.isPending}
            >
              {importFiles.isPending ? (
                <span className="loading loading-spinner loading-xs" />
              ) : (
                <UploadCloud className="h-4 w-4" />
              )}
              {importFiles.isPending ? 'Procesando…' : 'Seleccionar ficheros'}
            </button>
          </div>
        </div>

        {rejected.length > 0 ? (
          <p className="mt-3 text-[12px] text-error">
            Formato no soportado: {rejected.join(', ')}. Usa .docx, .xlsx o .json.
          </p>
        ) : null}

        {importFiles.isError ? (
          <p className="mt-3 rounded-lg bg-error/10 px-3 py-2 text-[12px] text-error">
            Error al importar: {importFiles.error.message}
          </p>
        ) : null}

        {importFiles.data ? (
          <div className="mt-4">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <p className="text-[12px] font-semibold text-base-content/70">
                Resultado de la importación
              </p>
              <span className="badge badge-ghost badge-xs">job {importFiles.data.job_id}</span>
              <button
                type="button"
                className="btn btn-ghost btn-xs ml-auto gap-1"
                onClick={() => navigate('/patients')}
              >
                Ver pacientes
              </button>
            </div>
            <ul className="grid gap-2 sm:grid-cols-2">
              {(importFiles.data.files ?? []).map((file, index) => (
                <ImportResultRow key={`${file.filename}-${index}`} file={file} />
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      {/* Lista de pacientes */}
      <section aria-label="Pacientes de la clínica">
        {isLoading ? (
          <LoadingCards count={3} />
        ) : isError ? (
          <ErrorState
            error={error}
            title="No se pudieron cargar los pacientes"
            onRetry={() => refetch()}
            hint="Si la API no está arrancada, el login demo tampoco funcionará"
          />
        ) : patients.length === 0 ? (
          <EmptyState
            title="Todavía no hay pacientes"
            description="Sube una historia clínica (.docx, .xlsx o .json) para crear el primer registro canónico."
            icon={<Search className="h-6 w-6" />}
            action={
              <button type="button" className="btn btn-primary btn-sm gap-1.5" onClick={handleLoadDemo}>
                <RotateCcw className="h-4 w-4" /> Cargar datos de demo
              </button>
            }
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {patients.map((patient) => (
              <PatientCard key={patient.id} patient={patient} />
            ))}
          </div>
        )}
      </section>

      <p className="text-center text-[11px] text-base-content/35">
        Última sincronización {formatDate(new Date().toISOString())} · registro canónico VetLink
      </p>
    </div>
  );
}

export default Patients;
