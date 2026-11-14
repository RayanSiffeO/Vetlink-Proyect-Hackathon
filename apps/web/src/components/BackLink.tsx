import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export function BackLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="inline-flex items-center gap-1.5 text-sm font-medium text-base-content/55 hover:text-secondary"
    >
      <ArrowLeft className="h-4 w-4" />
      {children}
    </Link>
  );
}
