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

const SPECIALIST_ITEMS: NavItem[] = [
  { to: '/requests', label: 'Solicitudes', icon: Send },
  { to: '/calendar', label: 'Calendario', icon: CalendarDays },
];

const PRIMARY_LINKS_CLASS = 'ml-2 hidden items-center gap-1 lg:flex';
const MOBILE_LINKS_CLASS =
  'mt-2 grid grid-cols-4 gap-0.5 border-t border-line/80 px-0.5 pt-2 pb-0.5 lg:hidden';
const NAV_ACTIVE_CLASS = 'bg-indigo text-ink shadow-lift';
const NAV_IDLE_CLASS = 'text-para hover:bg-white/70 hover:text-indigo-700';

function navLinkClass({ isActive }: { isActive: boolean }): string {
  const tone = isActive ? NAV_ACTIVE_CLASS : NAV_IDLE_CLASS;
  return `inline-flex items-center gap-2 rounded-full px-3 py-2 text-[13px] font-medium transition duration-200 ease-smooth hover:-translate-y-px ${tone}`;
}

function mobileNavLinkClass({ isActive }: { isActive: boolean }): string {
  const tone = isActive ? NAV_ACTIVE_CLASS : NAV_IDLE_CLASS;
  return `flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-0.5 py-1.5 text-center text-[9.5px] font-medium leading-3 transition duration-200 ease-smooth ${tone}`;
}

function NavBrand({ home }: { home: string }) {
  return (
    <Link
      to={home}
      className="group flex shrink-0 items-center gap-2.5 rounded-xl pr-1"
      aria-label="VetLink, inicio"
    >
      <span className="vl-wordmark text-[16px] font-medium tracking-[-0.02em]">VetLink</span>
      <span className="hidden text-[10.5px] leading-tight text-caption sm:block">
        Salud animal, a un clic
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
            <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="max-w-full truncate">{item.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}

function SessionChip({ user }: { user: User | null | undefined }) {
  if (!user) return null;
  return (
    <span className="hidden items-center gap-1.5 whitespace-nowrap rounded-full border border-line bg-white/70 px-2.5 py-1 text-[11px] font-medium text-para sm:inline-flex">
      <span className="h-1.5 w-1.5 rounded-full bg-ok" aria-hidden="true" />
      {user.display_name}
      <span className="text-line-strong">·</span>
      {roleLabel(user)}
    </span>
  );
}

type ResetMutation = ReturnType<typeof useResetDemo>;

const GHOST_BUTTON_CLASS =
  'inline-flex items-center gap-1.5 rounded-full border border-transparent px-2 py-1.5 text-[11.5px] font-medium text-caption transition duration-200 ease-smooth hover:-translate-y-px hover:border-line hover:bg-white/70 disabled:opacity-60';

function DemoResetButton({ reset, onSettled }: { reset: ResetMutation; onSettled: () => void }) {
  return (
    <button
      type="button"
      onClick={() => reset.mutate(undefined, { onSettled })}
      className={`${GHOST_BUTTON_CLASS} hover:text-indigo-700`}
      title="Reiniciar los datos de la demo"
      aria-label="Reiniciar datos de demo"
      disabled={reset.isPending}
    >
      {reset.isPending ? <Spinner size="xs" /> : <RotateCcw className="h-4 w-4" />}
      <span className="hidden text-[11.5px] xl:inline">Demo</span>
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
      className={`${GHOST_BUTTON_CLASS} hover:text-crit`}
      title="Cerrar sesión"
      disabled={logout.isPending}
    >
      <LogOut className="h-4 w-4" />
      <span className="hidden text-[11.5px] xl:inline">Salir</span>
    </button>
  );
}

function ResetStatusLine({ reset, done }: { reset: ResetMutation; done: boolean }) {
  if (!reset.isError && !done) return null;
  return (
    <p
      className={`px-3 pb-1 pt-1.5 text-center text-[11px] ${
        reset.isError ? 'text-crit' : 'text-ok'
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
    <header className="sticky top-0 z-40 bg-[linear-gradient(180deg,rgba(251,246,236,0.92)_0%,rgba(251,246,236,0.58)_60%,rgba(251,246,236,0)_100%)] px-3 pb-1 pt-3 sm:px-6 sm:pt-4">
      <div className="glass mx-auto w-full max-w-6xl rounded-[20px] px-3 py-2 sm:rounded-[22px] sm:px-4">
        <div className="flex items-center gap-3">
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
      </div>
    </header>
  );
}

export default Nav;
