import { ClipboardList, ScrollText, Sparkles } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { RequestTab } from '../../lib/requests';

interface TabItem {
  id: RequestTab;
  label: string;
  icon: LucideIcon;
}

const TABS: TabItem[] = [
  { id: 'detail', label: 'Detalle', icon: ClipboardList },
  { id: 'briefing', label: 'Briefing', icon: Sparkles },
  { id: 'audit', label: 'Auditoría', icon: ScrollText },
];

export function RequestTabs({
  tab,
  onSelect,
}: {
  tab: RequestTab;
  onSelect: (tab: RequestTab) => void;
}) {
  return (
    <div className="glass inline-flex w-full max-w-md gap-1 overflow-x-auto rounded-full p-1">
      {TABS.map((item) => {
        const Icon = item.icon;
        const active = tab === item.id;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={active}
            className={`inline-flex h-10 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-3 text-[12.5px] font-medium transition duration-200 ease-smooth ${
              active
                ? 'bg-indigo text-ink shadow-lift'
                : 'text-para hover:bg-white/70 hover:text-indigo-700'
            }`}
            onClick={() => onSelect(item.id)}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
