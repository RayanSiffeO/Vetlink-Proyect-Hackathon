import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { ApiError } from '../api/client';
import { useMe } from '../api/hooks';
import Nav from './Nav';
import { Spinner } from './Spinner';

export function AppBackdrop() {
  return (
    <div className="app-backdrop" aria-hidden="true">
      <span className="app-blob app-blob-cream" />
      <span className="app-blob app-blob-indigo" />
      <span className="app-blob app-blob-warm" />
    </div>
  );
}

function Splash() {
  return (
    <div className="grid min-h-screen place-items-center px-6">
      <div className="glass-strong rise flex flex-col items-center gap-3 rounded-panel px-10 py-9 text-center">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-indigo text-sm font-medium tracking-tight text-white shadow-lift">
          VL
        </span>
        <Spinner size="md" className="text-indigo" />
        <p className="text-[12.5px] text-caption">Conectando con VetLink…</p>
      </div>
    </div>
  );
}

function ApiUnavailable({ error }: { error: unknown }) {
  const message = error instanceof Error ? error.message : 'Error desconocido';
  const offline = error instanceof ApiError && error.status === 0;
  return (
    <div className="grid min-h-screen place-items-center px-4 py-10">
      <div className="glass-strong rise w-full max-w-md rounded-panel p-7 text-center">
        <h1 className="text-h3 font-medium text-ink">No hay conexión con la API</h1>
        <p className="mt-2 text-[13px] leading-5 text-caption">{message}</p>
        <p className="mt-3 rounded-2xl border border-line bg-mist/80 px-3 py-2 text-left font-mono text-[11px] leading-4 text-caption">
          {offline
            ? 'Arranca la API: cd services/api; uv run uvicorn app.main:app --reload --port 8000'
            : 'Revisa el log del backend o ejecuta POST /api/demo/reset.'}
        </p>
        <button
          type="button"
          className="mt-5 inline-flex items-center justify-center rounded-btn bg-indigo px-5 py-2.5 text-[13px] font-medium text-white shadow-lift transition duration-200 ease-smooth hover:-translate-y-0.5 hover:bg-indigo-700"
          onClick={() => window.location.reload()}
        >
          Reintentar
        </button>
      </div>
    </div>
  );
}

function Shell() {
  const { pathname } = useLocation();
  return (
    <div className="relative flex min-h-screen flex-col">
      <Nav />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-10 pt-6 sm:px-6 sm:pt-8">
        <div key={pathname} className="page-enter">
          <Outlet />
        </div>
      </main>
      <footer className="mx-auto w-full max-w-6xl px-4 pb-6 sm:px-6">
        <p className="glass flex flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-2xl px-4 py-2.5 text-center text-[11px] text-caption">
          <span className="font-medium text-para">VetLink</span>
          <span aria-hidden="true">·</span>
          <span>Entorno de demostración · datos ficticios y anonimizados</span>
          <span aria-hidden="true">·</span>
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
