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
    <div>
      <p className="vl-section-title">{heading.eyebrow}</p>
      <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold tracking-tight">
        <Icon className="h-6 w-6 text-secondary" aria-hidden="true" />
        {heading.title}
      </h1>
      <p className="mt-1 text-sm text-base-content/55">{heading.description}</p>
    </div>
  );
}

export function PageHeader({ heading, children }: { heading: PageHeading; children?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3">
      <PageTitle heading={heading} />
      {children}
    </header>
  );
}
