import { useEffect, useState } from 'react';
import { useMe } from '../api/hooks';
import { LoginBrand } from '../components/login/LoginBrand';
import { LoginIntro } from '../components/login/LoginIntro';
import { LoginRolePanel } from '../components/login/LoginRolePanel';

const INTRO_MS = 1650;

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function Login() {
  const { data: user } = useMe();
  const [intro, setIntro] = useState(() => !prefersReducedMotion());

  useEffect(() => {
    if (!intro) return undefined;
    const timer = window.setTimeout(() => setIntro(false), INTRO_MS);
    return () => window.clearTimeout(timer);
  }, [intro]);

  return (
    <div className={`relative min-h-screen bg-cream ${intro ? 'overflow-hidden' : ''}`}>
      {intro ? <LoginIntro onSkip={() => setIntro(false)} /> : null}
      <div className={`grid min-h-screen w-full lg:grid-cols-[55fr_45fr] ${intro ? '' : 'login-revealed'}`}>
        <LoginBrand />
        <LoginRolePanel user={user} />
      </div>
    </div>
  );
}

export default Login;
