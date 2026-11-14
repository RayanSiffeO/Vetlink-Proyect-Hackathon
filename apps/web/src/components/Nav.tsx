import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { CalendarDays, LogOut, RotateCcw, Send, Stethoscope, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useLogout, useMe, useResetDemo } from '../api/hooks';
import type { User } from '../api/types';
import { isSpecialist, roleLabel } from '../lib/format';
import { homeFor } from '../lib/routes';
import { Spinner } from './Spinner';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

const ALL_ITEMS: NavItem[] = [
  { to: '/patients', label: 'Pacientes', icon: Users },
  { to: '/specialists', label: 'Especialistas', icon: Stethoscope },
  { to: '/calendar', label: 'Calendario', icon: CalendarDays },
  { to: '/requests', label: 'Solicitudes', icon: Send },
];

const SPECIALIST_ITEMS: NavItem[] = ALL_ITEMS.filter((item) => item.to !== '/patients');

const PRIMARY_LINKS_CLASS = 'ml-4 hidden items-center gap-1 md:flex';
const MOBILE_LINKS_CLASS =
  'flex items-center justify-between gap-0.5 overflow-x-auto border-t border-base-300/60 px-2 py-1 md:hidden';
const NAV_ACTIVE_CLASS = 'bg-primary text-primary-content shadow-soft';
const NAV_IDLE_CLASS = 'text-base-content/65 hover:bg-base-200 hover:text-base-content';

function navLinkClass({ isActive }: { isActive: boolean }): string {
  const tone = isActive ? NAV_ACTIVE_CLASS : NAV_IDLE_CLASS;
  return `inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${tone}`;
}

function mobileNavLinkClass({ isActive }: { isActive: boolean }): string {
  const tone = isActive ? NAV_ACTIVE_CLASS : NAV_IDLE_CLASS;
  return `inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-xl px-1.5 py-2.5 text-[12px] font-medium transition-colors ${tone}`;
}

function NavBrand({ home }: { home: string }) {
  return (
    <Link to={home} className="flex shrink-0 items-center gap-2" aria-label="VetLink, inicio">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-[13px] font-black tracking-tight text-primary-content">
        VL
      </span>
      <span className="hidden leading-tight sm:block">
        <span className="block text-sm font-bold tracking-tight">VetLink</span>
        <span className="block text-[11px] text-base-content/50">Salud animal, a un clic</span>
      </span>
    </Link>
  );
}

function DesktopNavigation({ items }: { items: NavItem[] }) {
  return (
    <nav className={PRIMARY_LINKS_CLASS} aria-label="Navegación principal">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink key={item.to} to={item.to} className={navLinkClass}>
            <Icon className="h-4 w-4" aria-hidden="true" />
            {item.label}
          </NavLink>
        );
      })}
    </nav>
  );
}

function MobileNavigation({ items }: { items: NavItem[] }) {
  return (
    <nav className={MOBILE_LINKS_CLASS} aria-label="Navegación principal móvil">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink key={item.to} to={item.to} className={mobileNavLinkClass}>
            <Icon className="h-4 w-4" aria-hidden="true" />
            <span className="whitespace-nowrap">{item.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}

function SessionChip({ user }: { user: User | null | undefined }) {
  if (!user) return null;
  return (
    <span className="hidden items-center gap-1.5 rounded-full border border-base-300 bg-base-200/70 px-2.5 py-1 text-xs font-medium text-base-content/70 sm:inline-flex">
      <span className="h-1.5 w-1.5 rounded-full bg-secondary" aria-hidden="true" />
      {user.display_name}
      <span className="text-base-content/35">·</span>
      {roleLabel(user)}
    </span>
  );
}

type ResetMutation = ReturnType<typeof useResetDemo>;

function DemoResetButton({ reset, onSettled }: { reset: ResetMutation; onSettled: () => void }) {
  return (
    <button
      type="button"
      onClick={() => reset.mutate(undefined, { onSettled })}
      className="btn btn-ghost btn-sm gap-1.5 px-2 text-base-content/50 hover:text-base-content"
      title="Reiniciar los datos de la demo"
      aria-label="Reiniciar datos de demo"
      disabled={reset.isPending}
    >
      {reset.isPending ? <Spinner size="xs" /> : <RotateCcw className="h-4 w-4" />}
      <span className="hidden lg:inline text-xs">Demo</span>
    </button>
  );
}

function LogoutButton({
  logout,
  onSettled,
}: {
  logout: ReturnType<typeof useLogout>;
  onSettled: () => void;
}) {
  return (
    <button
      type="button"
      onClick={() => logout.mutate(undefined, { onSettled })}
      className="btn btn-ghost btn-sm gap-1.5 px-2 text-base-content/60 hover:text-error"
      title="Cerrar sesión"
      disabled={logout.isPending}
    >
      <LogOut className="h-4 w-4" />
      <span className="hidden lg:inline text-xs">Salir</span>
    </button>
  );
}

function ResetStatusLine({ reset, done }: { reset: ResetMutation; done: boolean }) {
  if (!reset.isError && !done) return null;
  return (
    <p
      className={`px-4 pb-1.5 text-center text-[11px] ${
        reset.isError ? 'text-error' : 'text-success'
      }`}
    >
      {reset.isError
        ? `No se pudo reiniciar la demo: ${reset.error.message}`
        : 'Datos de demo reiniciados'}
    </p>
  );
}

export function Nav() {
  const { data: user } = useMe();
  const logout = useLogout();
  const resetDemo = useResetDemo();
  const navigate = useNavigate();
  const [resetDone, setResetDone] = useState(false);

  const items = isSpecialist(user) ? SPECIALIST_ITEMS : ALL_ITEMS;
  const closeMenu = () => navigate('/login', { replace: true });
  const flagReset = () => {
    setResetDone(true);
    window.setTimeout(() => setResetDone(false), 2500);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-base-300/80 bg-base-100/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5">
        <NavBrand home={homeFor(user)} />
        <DesktopNavigation items={items} />
        <div className="ml-auto flex items-center gap-1.5">
          <SessionChip user={user} />
          <DemoResetButton reset={resetDemo} onSettled={flagReset} />
          <LogoutButton logout={logout} onSettled={closeMenu} />
        </div>
      </div>
      <MobileNavigation items={items} />
      <ResetStatusLine reset={resetDemo} done={resetDone} />
    </header>
  );
}

export default Nav;
