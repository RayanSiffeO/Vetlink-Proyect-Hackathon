import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { ApiError } from '../api/client';
import { useMe } from '../api/hooks';
import Nav from './Nav';
import { Spinner } from './Spinner';

function Splash() {
  return (
    <div className="grid min-h-screen place-items-center bg-base-200">
      <div className="flex flex-col items-center gap-3">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-primary text-sm font-black text-primary-content">
          VL
        </span>
        <Spinner size="md" className="text-secondary" />
        <p className="text-sm text-base-content/50">Conectando con VetLink…</p>
      </div>
    </div>
  );
}

function ApiUnavailable({ error }: { error: unknown }) {
  const message = error instanceof Error ? error.message : 'Error desconocido';
  const offline = error instanceof ApiError && error.status === 0;
  return (
    <div className="grid min-h-screen place-items-center bg-base-200 p-6">
      <div className="vl-card max-w-md p-6 text-center">
        <h1 className="text-lg font-semibold">No hay conexión con la API</h1>
        <p className="mt-2 text-sm text-base-content/60">{message}</p>
        <p className="mt-3 rounded-xl bg-base-200 px-3 py-2 text-left font-mono text-[11px] text-base-content/50">
          {offline
            ? 'Arranca la API: cd services/api; uv run uvicorn app.main:app --reload --port 8000'
            : 'Revisa el log del backend o ejecuta POST /api/demo/reset.'}
        </p>
        <button
          type="button"
          className="btn btn-primary btn-sm mt-4"
          onClick={() => window.location.reload()}
        >
          Reintentar
        </button>
      </div>
    </div>
  );
}

function Shell() {
  return (
    <div className="flex min-h-screen flex-col bg-base-200">
      <Nav />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:py-8">
        <Outlet />
      </main>
      <footer className="border-t border-base-300/70 bg-base-100/60 px-4 py-3">
        <p className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center text-[11px] text-base-content/45">
          <span className="font-semibold text-base-content/60">VetLink</span>
          <span>·</span>
          <span>Entorno de demostración · datos ficticios y anonimizados</span>
          <span>·</span>
          <span>VIII Hackathon Boehringer Ingelheim España</span>
        </p>
      </footer>
    </div>
  );
}

export function Layout() {
  const { data: user, isLoading, isError, error } = useMe();
  const location = useLocation();

  if (isLoading) return <Splash />;
  if (isError) return <ApiUnavailable error={error} />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <Shell />;
}

export default Layout;
