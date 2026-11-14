import { BrowserRouter, Link, Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import { useMe } from './api/hooks';
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
    <div className="grid min-h-screen place-items-center bg-base-200">
      <span className="loading loading-spinner loading-lg text-secondary" />
    </div>
  );
}

function HomeRedirect() {
  const { data: user, isLoading } = useMe();
  if (isLoading) return <Splash />;
  return <Navigate to={user ? homeFor(user) : '/login'} replace />;
}

function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center bg-base-200 p-6">
      <div className="vl-card max-w-md p-6 text-center">
        <p className="text-5xl font-black text-primary/20">404</p>
        <h1 className="mt-2 text-lg font-semibold">Esta pantalla no existe</h1>
        <p className="mt-1 text-sm text-base-content/55">
          Vuelve al inicio de la demo de VetLink.
        </p>
        <Link to="/" className="btn btn-primary btn-sm mt-4">
          Ir al inicio
        </Link>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<Layout />}>
          <Route path="/patients" element={<Patients />} />
          <Route path="/patients/:id" element={<PatientRecord />} />
          <Route path="/specialists" element={<Specialists />} />
          <Route path="/specialists/:id" element={<SpecialistDetail />} />
          <Route path="/requests" element={<Requests />} />
          <Route path="/requests/new" element={<RequestNew />} />
          <Route path="/requests/:id" element={<RequestDetail />} />
          <Route path="/calendar" element={<Calendar />} />
        </Route>
        <Route path="/" element={<HomeRedirect />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
