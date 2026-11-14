import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useLogin } from '../api/hooks';
import type { DemoUserId } from '../api/types';
import { resolveLoginTarget } from '../lib/routes';

export function useDemoLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const login = useLogin();
  const [pending, setPending] = useState<DemoUserId | null>(null);
  const from = (location.state as { from?: string } | null)?.from;

  const start = (role: DemoUserId) => {
    setPending(role);
    login.mutate(role, {
      onSuccess: (data) => navigate(resolveLoginTarget(from, data.user), { replace: true }),
      onSettled: () => setPending(null),
    });
  };

  return { login, pending, start };
}
