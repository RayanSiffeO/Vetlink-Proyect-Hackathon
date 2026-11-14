import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

export interface PageHeading {
  eyebrow: string;
  title: string;
  description: string;
  icon: LucideIcon;
}

export function PageTitle({ heading }: { heading: PageHeading }) {
  const Icon = heading.icon;
  return (
    <div className="min-w-0">
      <p className="vl-section-title text-indigo-700">{heading.eyebrow}</p>
      <h1 className="mt-1.5 flex items-center gap-2.5 text-[26px] font-medium leading-8 tracking-[-0.025em] text-ink sm:text-[32px] sm:leading-10">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-100">
          <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
        </span>
        {heading.title}
      </h1>
      <p className="mt-1 text-[13px] leading-5 text-caption">{heading.description}</p>
    </div>
  );
}

export function PageHeader({ heading, children }: { heading: PageHeading; children?: ReactNode }) {
  return (
    <header className="glass-strong flex flex-wrap items-end justify-between gap-3 rounded-panel px-5 py-4 sm:px-6 sm:py-5">
      <PageTitle heading={heading} />
      {children}
    </header>
  );
}

export default PageHeader;
