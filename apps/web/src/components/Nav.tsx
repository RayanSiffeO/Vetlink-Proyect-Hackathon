import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import {
  CalendarDays,
  LogOut,
  RotateCcw,
  Send,
  Stethoscope,
  Users,
} from 'lucide-react';
import { useLogout, useMe, useResetDemo } from '../api/hooks';
import { isSpecialist, roleLabel } from '../lib/format';
import { homeFor } from '../lib/routes';

interface NavItem {
  to: string;
  label: string;
  icon: typeof Users;
}

const ALL_ITEMS: NavItem[] = [
  { to: '/patients', label: 'Pacientes', icon: Users },
  { to: '/specialists', label: 'Especialistas', icon: Stethoscope },
  { to: '/calendar', label: 'Calendario', icon: CalendarDays },
  { to: '/requests', label: 'Solicitudes', icon: Send },
];

const SPECIALIST_ITEMS: NavItem[] = ALL_ITEMS.filter((item) => item.to !== '/patients');

export function Nav() {
  const { data: user } = useMe();
  const logout = useLogout();
  const resetDemo = useResetDemo();
  const navigate = useNavigate();
  const [resetDone, setResetDone] = useState(false);

  const items = isSpecialist(user) ? SPECIALIST_ITEMS : ALL_ITEMS;
  const home = homeFor(user);

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSettled: () => navigate('/login', { replace: true }),
    });
  };

  const handleReset = () => {
    resetDemo.mutate(undefined, {
      onSettled: () => {
        setResetDone(true);
        window.setTimeout(() => setResetDone(false), 2500);
      },
    });
  };

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
      isActive
        ? 'bg-primary text-primary-content shadow-soft'
        : 'text-base-content/65 hover:bg-base-200 hover:text-base-content'
    }`;

  return (
    <header className="sticky top-0 z-40 border-b border-base-300/80 bg-base-100/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5">
        <Link to={home} className="flex shrink-0 items-center gap-2" aria-label="VetLink, inicio">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-[13px] font-black tracking-tight text-primary-content">
            VL
          </span>
          <span className="hidden leading-tight sm:block">
            <span className="block text-sm font-bold tracking-tight">VetLink</span>
            <span className="block text-[11px] text-base-content/50">
              Salud animal, a un clic
            </span>
          </span>
        </Link>

        <nav className="ml-4 hidden items-center gap-1 md:flex" aria-label="Navegación principal">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink key={item.to} to={item.to} className={linkClass}>
                <Icon className="h-4 w-4" aria-hidden="true" />
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-1.5">
          {user ? (
            <span className="hidden items-center gap-1.5 rounded-full border border-base-300 bg-base-200/70 px-2.5 py-1 text-xs font-medium text-base-content/70 sm:inline-flex">
              <span className="h-1.5 w-1.5 rounded-full bg-secondary" aria-hidden="true" />
              {user.display_name}
              <span className="text-base-content/35">·</span>
              {roleLabel(user)}
            </span>
          ) : null}

          <button
            type="button"
            onClick={handleReset}
            className="btn btn-ghost btn-sm gap-1.5 px-2 text-base-content/50 hover:text-base-content"
            title="Reiniciar los datos de la demo"
            aria-label="Reiniciar datos de demo"
            disabled={resetDemo.isPending}
          >
            {resetDemo.isPending ? (
              <span className="loading loading-spinner loading-xs" />
            ) : (
              <RotateCcw className="h-4 w-4" />
            )}
            <span className="hidden lg:inline text-xs">Demo</span>
          </button>

          <button
            type="button"
            onClick={handleLogout}
            className="btn btn-ghost btn-sm gap-1.5 px-2 text-base-content/60 hover:text-error"
            title="Cerrar sesión"
            disabled={logout.isPending}
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden lg:inline text-xs">Salir</span>
          </button>
        </div>
      </div>

      {/* Navegación móvil: píldoras con scroll horizontal. */}
      <nav
        className="flex items-center gap-1 overflow-x-auto border-t border-base-300/60 px-3 py-1.5 md:hidden"
        aria-label="Navegación principal móvil"
      >
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink key={item.to} to={item.to} className={linkClass}>
              <Icon className="h-4 w-4" aria-hidden="true" />
              <span className="whitespace-nowrap">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {(resetDemo.isError || resetDone) && (
        <p
          className={`px-4 pb-1.5 text-center text-[11px] ${
            resetDemo.isError ? 'text-error' : 'text-success'
          }`}
        >
          {resetDemo.isError
            ? `No se pudo reiniciar la demo: ${resetDemo.error.message}`
            : 'Datos de demo reiniciados'}
        </p>
      )}
    </header>
  );
}

export default Nav;
