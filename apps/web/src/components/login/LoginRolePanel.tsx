import { useNavigate } from 'react-router-dom';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { ApiError } from '../../api/client';
import type { User } from '../../api/types';
import { isSpecialist } from '../../lib/format';
import { homeFor } from '../../lib/routes';
import { useDemoLogin } from '../../hooks/useDemoLogin';
import { Spinner } from '../Spinner';
import { ROLE_CARDS, type RoleCard } from './roles';

interface RoleCardState {
  busy: boolean;
  disabled: boolean;
}

interface RoleTone {
  card: string;
  icon: string;
  title: string;
  badge: string;
  text: string;
  arrow: string;
  spinner: string;
}

const ROLE_TONES: Record<'primary' | 'secondary', RoleTone> = {
  primary: {
    card: 'border-white/10 bg-[linear-gradient(135deg,#C46B4D_0%,#9E4C36_72%)] text-white shadow-lift hover:shadow-card',
    icon: 'border border-white/20 bg-white/15 text-white',
    title: 'text-white',
    badge: 'border-white/20 bg-indigo-900/35 text-white/90',
    text: 'text-white/80',
    arrow: 'text-white/70 group-hover:text-white',
    spinner: 'text-white',
  },
  secondary: {
    card: 'border-line-strong bg-white/85 text-ink hover:border-indigo-300 hover:bg-white hover:shadow-soft',
    icon: 'bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-100',
    title: 'text-ink',
    badge: 'border-indigo-100 bg-indigo-50 text-indigo-700',
    text: 'text-caption',
    arrow: 'text-indigo-300 group-hover:text-indigo-700',
    spinner: 'text-indigo',
  },
};

const ROLE_CARD_CLASS =
  'group relative flex w-full items-start gap-3 overflow-hidden rounded-btn border p-3.5 text-left transition duration-200 ease-smooth hover:-translate-y-0.5 disabled:cursor-progress';

function RoleCardIcon({ card, tone }: { card: RoleCard; tone: RoleTone }) {
  const Icon = card.icon;
  return (
    <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${tone.icon}`}>
      <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
    </span>
  );
}

function RoleCardText({ card, tone }: { card: RoleCard; tone: RoleTone }) {
  return (
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className={`text-[14px] font-medium leading-5 ${tone.title}`}>{card.title}</span>
        <span
          className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[9.5px] font-medium leading-3 ${tone.badge}`}
        >
          {card.subtitle}
        </span>
      </div>
      <p className={`mt-1 text-[11.5px] leading-4 ${tone.text}`}>{card.description}</p>
    </div>
  );
}

function RoleCardArrow({ busy, tone }: { busy: boolean; tone: RoleTone }) {
  return (
    <span className={`mt-1 shrink-0 ${tone.arrow}`}>
      {busy ? <Spinner size="sm" className={tone.spinner} /> : <ArrowRight className="h-[18px] w-[18px]" />}
    </span>
  );
}

function RoleCardButton({
  card,
  state,
  onSelect,
}: {
  card: RoleCard;
  state: RoleCardState;
  onSelect: () => void;
}) {
  const tone = ROLE_TONES[card.primary ? 'primary' : 'secondary'];
  const dimmed = state.disabled && !state.busy ? 'opacity-60' : '';
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={state.disabled}
      className={`${ROLE_CARD_CLASS} ${tone.card} ${dimmed}`}
      data-demo-user={card.id}
    >
      <RoleCardIcon card={card} tone={tone} />
      <RoleCardText card={card} tone={tone} />
      <RoleCardArrow busy={state.busy} tone={tone} />
    </button>
  );
}

function ActiveSessionCard({ user }: { user: User }) {
  const navigate = useNavigate();
  return (
    <div className="mt-3.5 rounded-2xl border border-indigo/20 bg-indigo-50/80 p-3">
      <p className="text-[12px] font-medium leading-4 text-indigo-700">
        Sesión activa como {user.display_name} ({isSpecialist(user) ? 'especialista' : 'clínica'})
      </p>
      <button
        type="button"
        className="mt-2 inline-flex items-center gap-1.5 rounded-btn bg-indigo px-3 py-1.5 text-[12px] font-medium text-ink shadow-lift transition duration-200 ease-smooth hover:-translate-y-px hover:bg-indigo-300"
        onClick={() => navigate(homeFor(user), { replace: true })}
      >
        Continuar <ArrowRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function LoginErrorAlert({ error }: { error: Error }) {
  const isOffline = error instanceof ApiError && error.status === 0;
  return (
    <div
      className="mt-4 rounded-2xl border border-crit/25 bg-crit-soft px-3.5 py-3 text-left"
      role="alert"
    >
      <p className="flex items-center gap-1.5 text-[12px] font-medium text-crit">
        <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
        No se pudo iniciar la demo
      </p>
      <p className="mt-1 text-[11.5px] leading-4 text-[#7A2A31]">{error.message}</p>
      {isOffline ? (
        <p className="mt-2 rounded-lg bg-white/70 px-2 py-1 font-mono text-[10.5px] text-[#7A2A31]">
          cd services/api; uv run uvicorn app.main:app --reload --port 8000
        </p>
      ) : null}
    </div>
  );
}

function SsoLink() {
  return (
    <button
      type="button"
      disabled
      title="El SSO de la clínica no está habilitado en la demo"
      className="inline-flex items-center justify-center gap-1.5 rounded-full px-2 py-1 text-[12px] font-medium text-indigo-700/80"
    >
      <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
      Entrar con SSO de la clínica
    </button>
  );
}

function PanelGlow() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <span className="absolute -right-40 -top-56 h-[560px] w-[560px] rounded-full bg-[radial-gradient(circle,rgba(246,220,203,0.7),rgba(251,244,234,0)_70%)]" />
      <span className="absolute -bottom-56 -left-32 h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle,rgba(233,180,138,0.55),rgba(251,244,234,0)_70%)]" />
    </div>
  );
}

function LoginFootNote() {
  return (
    <p className="mt-4 text-center text-[10px] text-caption">
      Entorno de demostración · datos ficticios · Equipo Joniha
    </p>
  );
}

function MobileBrand() {
  return (
    <div className="mb-5 flex items-center gap-2.5 lg:hidden">
      <span className="vl-wordmark text-[16px] font-medium leading-5 tracking-[-0.02em]">VetLink</span>
      <span className="text-[10.5px] leading-4 text-caption">Salud animal, a un clic</span>
    </div>
  );
}

export function LoginRolePanel({ user }: { user: User | null | undefined }) {
  const { login, pending, start } = useDemoLogin();

  return (
    <section className="login-panel relative order-1 flex flex-col items-center justify-center overflow-hidden bg-mist px-4 py-8 sm:px-8 sm:py-10 lg:order-2 lg:min-h-screen lg:px-10">
      <PanelGlow />
      <div className="relative z-10 w-full max-w-[432px]">
        <MobileBrand />
        <div className="glass-strong rounded-[30px] px-5 py-6 sm:px-7 sm:py-7">
          <div className="flex items-center justify-between gap-3">
            <p className="flex items-center gap-1.5 text-[9.5px] font-medium uppercase tracking-[0.14em] text-indigo-700">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              Acceso seguro
            </p>
            <span className="inline-flex items-center rounded-full border border-line bg-white/70 px-2 py-0.5 text-[10px] font-medium text-caption">
              sin contraseña
            </span>
          </div>

          <h2 className="mt-2.5 text-[27px] font-medium leading-[1.2] tracking-[-0.02em] text-ink">
            Entra en la demo
          </h2>
          <p className="mt-1.5 text-[12.5px] leading-[18px] text-caption">
            Elige tu lado.
          </p>

          {user ? <ActiveSessionCard user={user} /> : null}

          <div className="mt-4 grid gap-2.5">
            {ROLE_CARDS.map((card) => (
              <RoleCardButton
                key={card.id}
                card={card}
                state={{ busy: pending === card.id, disabled: login.isPending }}
                onSelect={() => start(card.id)}
              />
            ))}
          </div>

          {login.error ? <LoginErrorAlert error={login.error} /> : null}

          <div className="mt-4 flex items-center gap-3 text-[9.5px] uppercase tracking-[0.14em] text-caption">
            <span className="h-px flex-1 bg-line" aria-hidden="true" />
            <span>o</span>
            <span className="h-px flex-1 bg-line" aria-hidden="true" />
          </div>

          <div className="mt-2.5 text-center">
            <SsoLink />
          </div>
        </div>
        <LoginFootNote />
      </div>
    </section>
  );
}

export default LoginRolePanel;
