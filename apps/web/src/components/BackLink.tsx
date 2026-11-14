import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export function BackLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="group inline-flex items-center gap-1.5 rounded-full border border-line bg-white/70 px-3 py-1.5 text-[12.5px] font-medium text-para transition duration-200 ease-smooth hover:-translate-y-px hover:border-indigo-100 hover:bg-white hover:text-indigo-700 hover:shadow-soft"
    >
      <ArrowLeft className="h-3.5 w-3.5 transition duration-200 ease-smooth group-hover:-translate-x-0.5" />
      {children}
    </Link>
  );
}

export default BackLink;
