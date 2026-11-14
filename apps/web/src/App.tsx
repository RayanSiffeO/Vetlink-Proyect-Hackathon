import { BrowserRouter, Link, Navigate, Route, Routes } from 'react-router-dom';
import type { ReactNode } from 'react';
import Layout, { AppBackdrop } from './components/Layout';
import { Spinner } from './components/Spinner';
import { useMe } from './api/hooks';
import { isSpecialist } from './lib/format';
import { homeFor } from './lib/routes';
import Calendar from './pages/Calendar';
import Login from './pages/Login';
import PatientRecord from './pages/PatientRecord';
import Patients from './pages/Patients';
import RequestDetail from './pages/RequestDetail';
import RequestNew from './pages/RequestNew';
import Requests from './pages/Requests';
import SpecialistDetail from './pages/SpecialistDetail';
import Specialists from './pages/Specialists';

function Splash() {
  return (
    <div className="grid min-h-screen place-items-center px-6">
      <div className="glass-strong rise flex flex-col items-center gap-3 rounded-panel px-10 py-9 text-center">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-indigo text-sm font-medium tracking-tight text-ink shadow-lift">
          VL
        </span>
        <Spinner size="md" className="text-indigo" />
      </div>
    </div>
  );
}

function HomeRedirect() {
  const { data: user, isLoading } = useMe();
  if (isLoading) return <Splash />;
  return <Navigate to={user ? homeFor(user) : '/login'} replace />;
}

function ClinicOnly({ children }: { children: ReactNode }) {
  const { data: user, isLoading } = useMe();
  if (isLoading) return <Splash />;
  if (user && isSpecialist(user)) return <Navigate to="/requests" replace />;
  return <>{children}</>;
}

function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center px-4 py-10">
      <div className="glass-strong rise w-full max-w-md rounded-panel p-7 text-center sm:p-8">
        <p className="text-[56px] font-medium leading-none tracking-[-0.04em] text-indigo-100">404</p>
        <h1 className="mt-3 text-h3 font-medium text-ink">Esta pantalla no existe</h1>
        <p className="mt-1.5 text-[13px] leading-5 text-caption">
          Vuelve al inicio de la demo de VetLink.
        </p>
        <Link
          to="/"
          className="mt-5 inline-flex items-center justify-center rounded-btn bg-ink px-5 py-2.5 text-[13px] font-medium text-cream shadow-lift transition duration-200 ease-smooth hover:-translate-y-0.5 hover:bg-[#3A2E26]"
        >
          Ir al inicio
        </Link>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppBackdrop />
      <div className="relative z-10">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<Layout />}>
            <Route path="/patients" element={<ClinicOnly><Patients /></ClinicOnly>} />
            <Route path="/patients/:id" element={<ClinicOnly><PatientRecord /></ClinicOnly>} />
            <Route path="/specialists" element={<ClinicOnly><Specialists /></ClinicOnly>} />
            <Route path="/specialists/:id" element={<ClinicOnly><SpecialistDetail /></ClinicOnly>} />
            <Route path="/requests" element={<Requests />} />
            <Route path="/requests/new" element={<ClinicOnly><RequestNew /></ClinicOnly>} />
            <Route path="/requests/:id" element={<RequestDetail />} />
            <Route path="/calendar" element={<Calendar />} />
          </Route>
          <Route path="/" element={<HomeRedirect />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
